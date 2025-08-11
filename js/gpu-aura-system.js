// Sistema de partículas basado en GPU (GPGPU) usando GPUComputationRenderer
// Paso A: Implementación inicial mínima (posición + velocidad en GPU, color estático en CPU)
(function(){
    if (!window.THREE) return;
    if (!window.GPUComputationRenderer) {
        console.warn('GPUComputationRenderer no disponible todavía.');
    }

    class GpuAuraSystem {
        constructor(options = {}) {
            this.sphereRadius = options.sphereRadius ?? (window.AURA_SPHERE_RADIUS ?? 8);
            this.desiredCount = options.particleCount || 4096; // se redondeará a cuadrado
            this.texSize = Math.ceil(Math.sqrt(this.desiredCount));
            this.particleCount = this.texSize * this.texSize;
            this.time = 0;
            // Warmup: cuadros iniciales con jitter tangencial adicional para romper simetrías
            this.warmupFrames = options.warmupFrames ?? 180; // ~3s a 60fps
            this.initialWarmupFrames = this.warmupFrames; // para normalizar
            this.debugSimple = false; // activar manualmente para depurar sampling
            this.pointSizeFactor = options.pointSizeFactor || 1.0; // factor externo
                // Parámetros dinámicos (alineados con versión CPU)
                this.params = {
                    temperature: 20,
                    weight: 70,
                    movement: 50,
                    height: 170,
                    heartRate: 80,
                    sound: 30,
                    proximity: 'close',
                    posture: 'upright',
                    emotion: 'reflective',
                    ...(options.params||{})
                };
                // Perfiles emocionales y transición
                this.currentEmotionProfile = this.getEmotionProfile(this.params.emotion);
                this.targetEmotionProfile = { ...this.currentEmotionProfile };
                this.emotionTransitionT = 1; // sin transición inicial
                this.EMOTION_TRANSITION_DURATION = 1.8;
                this.emotionPhase = 0; // fase acumulativa (evita saltos)
            this.rendererRef = options.renderer || window.auraApp?.renderer || null;
            this._initGPU();
            this._initRenderPoints();
        }

        _initGPU() {
            if (!window.GPUComputationRenderer) return;
            if (!this.rendererRef) { console.error('GpuAuraSystem: renderer compartido no disponible'); return; }
            const size = this.texSize;
            this.gpuCompute = new GPUComputationRenderer(size, size, this.rendererRef);
            const dtPosition = this.gpuCompute.createTexture();
            const dtVelocity = this.gpuCompute.createTexture();
            this._fillInitialTextures(dtPosition, dtVelocity);
            this.posVariable = this.gpuCompute.addVariable('texturePosition', this._positionFragmentShader(), dtPosition);
            this.velVariable = this.gpuCompute.addVariable('textureVelocity', this._velocityFragmentShader(), dtVelocity);
            this.gpuCompute.setVariableDependencies(this.posVariable, [this.posVariable, this.velVariable]);
            this.gpuCompute.setVariableDependencies(this.velVariable, [this.posVariable, this.velVariable]);
            Object.assign(this.posVariable.material.uniforms, { delta: { value: 0.016 }, radius: { value: this.sphereRadius }, warmup: { value: 1.0 }, time: { value: 0 } });
            Object.assign(this.velVariable.material.uniforms, { delta: { value: 0.016 }, time: { value: 0 }, orbitStrength: { value: 0.6 }, damping: { value: 0.985 }, radius: { value: this.sphereRadius }, noiseMultiplier: { value: 1.0 } });
            // Postura / proximidad (GPU)
            this.posVariable.material.uniforms.postureScale = { value: new THREE.Vector3(1,1,1) };
            this.posVariable.material.uniforms.proximityScale = { value: 1.0 };
            const err = this.gpuCompute.init();
            if (err) console.error('GPUComputation init error', err);
            // Pre-cómputo (prewarm) para dispersar antes de primer render
            if (!err) this._prewarmCompute();
        }

        _fillInitialTextures(posTex, velTex) {
            const size = this.texSize;
            const dataPos = posTex.image.data;
            const dataVel = velTex.image.data;
            const N = this.particleCount;
            const golden = Math.PI * (3 - Math.sqrt(5));
            for (let i = 0; i < N; i++) {
                const k = i + 0.5;
                const y = 1 - (2 * k) / N;
                const r = Math.sqrt(Math.max(0, 1 - y*y));
                const phi = i * golden;
                const x = Math.cos(phi) * r;
                const z = Math.sin(phi) * r;
                const idx = i * 4;
                // Posición base en esfera
                let px = x * this.sphereRadius;
                let py = y * this.sphereRadius;
                let pz = z * this.sphereRadius;
                // Pequeña perturbación tangencial para evitar agrupaciones simétricas
                const pr = (Math.random()-0.5) * 0.05 * this.sphereRadius;
                // vector ortogonal aproximado
                const ox = -z;
                const oz = x;
                px += ox * pr;
                pz += oz * pr;
                // Colocar dentro de la esfera (no todos sobre la superficie) para activar fuerza radial
                const floatRand = Math.random();
                const radialFactor = 0.65 + floatRand * 0.35; // 0.65R .. 1.0R
                px *= radialFactor;
                py *= radialFactor;
                pz *= radialFactor;
                dataPos[idx] = px;
                dataPos[idx+1] = py;
                dataPos[idx+2] = pz;
                dataPos[idx+3] = Math.random(); // seed emocional / ruido
                dataVel[idx] = -z * 0.02;
                dataVel[idx+1] = (Math.random()-0.5) * 0.01;
                dataVel[idx+2] = x * 0.02;
                dataVel[idx+3] = 1; // reservado
            }
            for (let i = N; i < size*size; i++) {
                const idx = i*4;
                dataPos[idx]=0;dataPos[idx+1]=0;dataPos[idx+2]=0;dataPos[idx+3]=1;
                dataVel[idx]=0;dataVel[idx+1]=0;dataVel[idx+2]=0;dataVel[idx+3]=1;
            }
            // Asegurar subida al GPU tras modificar arrays
            posTex.needsUpdate = true;
            velTex.needsUpdate = true;
        }

                            _velocityFragmentShader() {
                                    return `precision highp float;
            uniform vec2 resolution;
            uniform sampler2D texturePosition;
            uniform sampler2D textureVelocity;
            uniform float delta;
            uniform float time;
            uniform float orbitStrength;
            uniform float damping;
            uniform float radius;
            uniform float noiseMultiplier;
            vec3 hash3(vec3 p){ p=fract(p*0.3183099+vec3(.1,.2,.3)); p+=dot(p,p.yzx+19.19); return fract((p.xxy+p.yzz)*p.zyx); }
            void main(){
                vec2 uv=gl_FragCoord.xy / resolution.xy;
                vec4 pos4 = texture2D(texturePosition, uv);
                vec3 pos = pos4.xyz;
                vec3 vel = texture2D(textureVelocity, uv).xyz;
            #ifdef SIMPLE_DEBUG
                gl_FragColor = vec4(vel,1.0); return;
            #endif
                float ang = orbitStrength * delta;
                float cs = cos(ang); float sn = sin(ang);
                vec3 rotated = vec3(pos.x*cs - pos.z*sn, pos.y, pos.x*sn + pos.z*cs);
                vel += (rotated - pos) * 0.25;
                vec3 h = hash3(pos * 0.15 + time*0.5) - 0.5;
                vel += h * (0.15 * noiseMultiplier) * delta;
                float breath = sin(time*0.5) * 0.02;
                vec3 dir = normalize(pos + 0.00001);
                vel += dir * breath;
                float len = max(length(pos), 0.0001);
                float diff = radius - len;
                vel += dir * diff * 0.5 * delta;
                vel *= damping;
                gl_FragColor = vec4(vel, 1.0);
            }`;
                            }

                _positionFragmentShader() {
                        return `precision highp float;
uniform vec2 resolution;
uniform sampler2D texturePosition;
uniform sampler2D textureVelocity;
uniform float delta;
uniform float radius;
uniform float time;
uniform float tangentialWaveAmp;
uniform float waveSpeed;
uniform float radialJitter;
uniform float shellThickness;
uniform float emotionPhase;
uniform float pulsate;
uniform float proximityScale;
uniform vec3 postureScale;
uniform float warmup; // 1..0 durante fase de dispersión inicial
void main(){
    vec2 uv=gl_FragCoord.xy / resolution.xy;
    vec4 pos4 = texture2D(texturePosition, uv);
    vec3 pos = pos4.xyz;
    float seed = pos4.w;
    vec3 vel = texture2D(textureVelocity, uv).xyz;
#ifdef SIMPLE_DEBUG
    gl_FragColor = vec4(pos, seed); return;
#endif
    pos += vel * delta;
    float len0 = max(length(pos), 0.0001);
    vec3 dir = pos / len0;
    vec3 up = abs(dir.y) < 0.999 ? vec3(0.0,1.0,0.0) : vec3(1.0,0.0,0.0);
    vec3 t1 = normalize(cross(up, dir));
    vec3 t2 = normalize(cross(dir, t1));
    // Jitter tangencial durante warmup para romper agrupaciones axiales
    if(warmup > 0.001){
        float js = seed + time * 0.73;
        float j1 = fract(sin(js*43758.5453))*2.0 - 1.0;
        float j2 = fract(sin((js+1.2345)*27183.1353))*2.0 - 1.0;
        // Amplitud decreciente: fracción del radio (hasta ~40% * 0.5 = 0.2R efectiva)
        float jitterAmp = (0.4 * warmup) * radius * 0.5;
        pos += (t1 * j1 + t2 * j2) * jitterAmp;
    }
    float wavePhase = emotionPhase + seed * 6.2831853;
    float tangA = sin(wavePhase) * tangentialWaveAmp;
    float tangB = cos(wavePhase * 0.7 + seed) * tangentialWaveAmp * 0.7;
    pos += t1 * tangA + t2 * tangB;
    float radialWave = sin(wavePhase * 1.3) * radialJitter;
    float desiredRadius = radius * proximityScale + radialWave * shellThickness;
    float len = max(length(pos), 0.0001);
    // Reproyección parcial para evitar aplanar en polos
    vec3 shellPos = pos / len * desiredRadius;
    float projMix = mix(0.15, 0.65, 1.0 - warmup); // durante warmup menor proyección para permitir difusión
    pos = mix(pos, shellPos, projMix);
    // Aplicar postura DESPUÉS de la proyección para no sesgar el muestreo hacia los polos
    pos *= postureScale;
    gl_FragColor = vec4(pos, seed);
}`;
                }

        _initRenderPoints() {
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(this.particleCount * 3);
            geometry.setAttribute('position', new THREE.BufferAttribute(positions,3));
            const refs = new Float32Array(this.particleCount * 2);
            for (let i=0;i<this.particleCount;i++) {
                const x = (i % this.texSize) + 0.5;
                const y = Math.floor(i / this.texSize) + 0.5;
                refs[i*2] = x / this.texSize;
                refs[i*2+1] = y / this.texSize;
            }
            geometry.setAttribute('ref', new THREE.BufferAttribute(refs, 2));
            const baseHSL = AuraUtils.getTemperatureColor(this.params.temperature);
            const variations = AuraUtils.generateColorVariations(baseHSL, 20);
            const colorArray = new Float32Array(this.particleCount * 3);
            for (let i=0;i<this.particleCount;i++) {
                const c = variations[i % variations.length];
                colorArray[i*3]=c.r; colorArray[i*3+1]=c.g; colorArray[i*3+2]=c.b;
            }
            geometry.setAttribute('baseColor', new THREE.BufferAttribute(colorArray,3));
            const sizes = new Float32Array(this.particleCount);
            for (let i=0;i<this.particleCount;i++) sizes[i]=(0.5 + Math.random()*0.34) * this.pointSizeFactor; // mayores
            geometry.setAttribute('sizeAttr', new THREE.BufferAttribute(sizes,1));

            const tempAura = new AuraSystem({ sphereRadius: this.sphereRadius });
            const particleTex = tempAura.particles.material.uniforms.pointTexture.value;

            const material = new THREE.ShaderMaterial({
                                uniforms: { posTex: { value: null }, texSize: { value: this.texSize }, time: { value: 0 }, pointTexture: { value: particleTex }, pulseFactor: { value: 1.0 }, maxPointSize: { value: 18.0 }, debugMode: { value: 0 } },
                                vertexShader: this._renderVertexShader(),
                                fragmentShader: this._renderFragmentShader(),
                                blending: THREE.AdditiveBlending,
                                transparent: true,
                                depthTest: false,
                                vertexColors: false
                        });
            tempAura.dispose();
            this.particles = new THREE.Points(geometry, material);
        }

                _renderVertexShader() {
                                                return `precision highp float;
uniform sampler2D posTex;
uniform float time;
uniform float pulseFactor;
uniform float maxPointSize;
uniform int debugMode;
attribute vec2 ref;
attribute float sizeAttr;
attribute vec3 baseColor;
varying vec3 vColor;
void main(){
    vec4 p4 = texture2D(posTex, ref);
    vec3 pos = p4.xyz;
    if(debugMode==1){ vColor = vec3(ref.x, ref.y, 0.0); }
    else if(debugMode==2){ vColor = normalize(abs(pos)); }
    else { vColor = baseColor; }
    float seed = fract(ref.x*53.13 + ref.y*91.7);
    float pulse = 1.0 + sin(time * 2.0 + seed * 6.2831853) * 0.15 * pulseFactor;
    vec4 mvPosition = modelViewMatrix * vec4(pos,1.0);
    float distScale = 120.0 / max(-mvPosition.z, 0.001);
    float ps = sizeAttr * distScale * pulse;
    gl_PointSize = min(ps, maxPointSize);
    gl_Position = projectionMatrix * mvPosition;
}`;
                }

                _renderFragmentShader() {
                        return `
                            uniform sampler2D pointTexture;\n
                            varying vec3 vColor;\n
                            void main(){\n
                                vec4 tex = texture2D(pointTexture, gl_PointCoord);\n
                                if(tex.a < 0.1) discard;\n
                                vec3 base = vColor;\n
                                float lum = dot(base, vec3(0.2126,0.7152,0.0722));\n
                                // Suavizar y evitar saturación blanca
                                vec3 color = mix(base, vec3(lum), 0.15);\n
                                gl_FragColor = vec4(color, tex.a * 0.85);\n
                            }`;
                }

        updateParams(p) {
            const oldEmotion = this.params.emotion;
            this.params = { ...this.params, ...p };
            // Cambio de emoción -> iniciar transición
            if (p.emotion && p.emotion !== oldEmotion) {
                this.targetEmotionProfile = this.getEmotionProfile(this.params.emotion);
                this.emotionTransitionT = 0;
            }
            if (p.temperature !== undefined) {
                const baseHSL = AuraUtils.getTemperatureColor(this.params.temperature);
                const variations = AuraUtils.generateColorVariations(baseHSL, 20);
                const colorAttr = this.particles.geometry.getAttribute('baseColor');
                for (let i=0;i<this.particleCount;i++) {
                    const c = variations[i % variations.length];
                    colorAttr.array[i*3]=c.r; colorAttr.array[i*3+1]=c.g; colorAttr.array[i*3+2]=c.b;
                }
                colorAttr.needsUpdate = true;
            }
        }

        getEmotionProfile(emotion) {
            switch (emotion) {
                case 'impulsive': return { orbitMultiplier:1.4, noiseMultiplier:2.2, tangentialWaveAmp:0.28, waveSpeed:2.2, radialJitter:0.20, shellThickness:0.35, pulseMultiplier:1.25 };
                case 'expansive': return { orbitMultiplier:1.2, noiseMultiplier:1.3, tangentialWaveAmp:0.18, waveSpeed:1.1, radialJitter:0.15, shellThickness:0.25, pulseMultiplier:1.15 };
                case 'contained': return { orbitMultiplier:0.7, noiseMultiplier:0.6, tangentialWaveAmp:0.10, waveSpeed:0.9, radialJitter:0.05, shellThickness:0.05, pulseMultiplier:0.85 };
                case 'reflective':
                default: return { orbitMultiplier:0.9, noiseMultiplier:0.8, tangentialWaveAmp:0.12, waveSpeed:0.6, radialJitter:0.07, shellThickness:0.12, pulseMultiplier:1.0 };
            }
        }

        animate(delta) {
            if (!this.gpuCompute) return;
            this.time += delta;
            // Interpolar perfil emocional
            if (this.emotionTransitionT < 1) {
                this.emotionTransitionT += delta / this.EMOTION_TRANSITION_DURATION;
                if (this.emotionTransitionT > 1) this.emotionTransitionT = 1;
            }
            const tEase = this.emotionTransitionT < 1 ? (1 - Math.cos(this.emotionTransitionT * Math.PI)) / 2 : 1;
            const blend = (a,b)=> a + (b-a)*tEase;
            const active = {
                orbitMultiplier: blend(this.currentEmotionProfile.orbitMultiplier, this.targetEmotionProfile.orbitMultiplier),
                noiseMultiplier: blend(this.currentEmotionProfile.noiseMultiplier, this.targetEmotionProfile.noiseMultiplier),
                tangentialWaveAmp: blend(this.currentEmotionProfile.tangentialWaveAmp, this.targetEmotionProfile.tangentialWaveAmp),
                waveSpeed: blend(this.currentEmotionProfile.waveSpeed, this.targetEmotionProfile.waveSpeed),
                radialJitter: blend(this.currentEmotionProfile.radialJitter, this.targetEmotionProfile.radialJitter),
                shellThickness: blend(this.currentEmotionProfile.shellThickness, this.targetEmotionProfile.shellThickness),
                pulseMultiplier: blend(this.currentEmotionProfile.pulseMultiplier, this.targetEmotionProfile.pulseMultiplier)
            };
            if (this.emotionTransitionT === 1 && this.currentEmotionProfile !== this.targetEmotionProfile) {
                this.currentEmotionProfile = { ...this.targetEmotionProfile };
            }
            // Actualizar fase emocional acumulativa (usa waveSpeed activo)
            this.emotionPhase += delta * active.waveSpeed;
            // Parámetros derivados de movimiento / sonido / heartRate
            const movementSpeedBase = AuraUtils.mapRange(this.params.movement, 0, 100, 0.5, 3.0);
            const orbitStrengthBase = AuraUtils.mapRange(this.params.movement, 0, 100, 0.8, 2.5);
            const orbitStrength = orbitStrengthBase * active.orbitMultiplier * 0.05; // factor de escala menor para shader
            const pulseFactor = active.pulseMultiplier;
            // Uniforms velocity
            this.velVariable.material.uniforms.delta.value = delta;
            this.velVariable.material.uniforms.time.value = this.time;
            this.velVariable.material.uniforms.orbitStrength.value = orbitStrength * delta * movementSpeedBase; // escalado
            this.velVariable.material.uniforms.noiseMultiplier = this.velVariable.material.uniforms.noiseMultiplier || { value:1 };
            this.velVariable.material.uniforms.noiseMultiplier.value = active.noiseMultiplier;
            // Uniforms position
            this.posVariable.material.uniforms.delta.value = delta;
            this.posVariable.material.uniforms.time = this.posVariable.material.uniforms.time || { value:0 };
            this.posVariable.material.uniforms.time.value = this.time;
            this.posVariable.material.uniforms.tangentialWaveAmp = this.posVariable.material.uniforms.tangentialWaveAmp || { value:0 };
            this.posVariable.material.uniforms.tangentialWaveAmp.value = active.tangentialWaveAmp;
            this.posVariable.material.uniforms.waveSpeed = this.posVariable.material.uniforms.waveSpeed || { value:0 };
            this.posVariable.material.uniforms.waveSpeed.value = active.waveSpeed; // (no usado directamente, mantenemos por extensibilidad)
            this.posVariable.material.uniforms.radialJitter = this.posVariable.material.uniforms.radialJitter || { value:0 };
            this.posVariable.material.uniforms.radialJitter.value = active.radialJitter;
            this.posVariable.material.uniforms.shellThickness = this.posVariable.material.uniforms.shellThickness || { value:0 };
            this.posVariable.material.uniforms.shellThickness.value = active.shellThickness;
            this.posVariable.material.uniforms.emotionPhase = this.posVariable.material.uniforms.emotionPhase || { value:0 };
            this.posVariable.material.uniforms.emotionPhase.value = this.emotionPhase;
            // Warmup decay
            if (!this.posVariable.material.uniforms.warmup) {
                this.posVariable.material.uniforms.warmup = { value: 0 };
            }
            if (this.warmupFrames > 0 && this.initialWarmupFrames > 0) {
                this.posVariable.material.uniforms.warmup.value = this.warmupFrames / this.initialWarmupFrames;
                this.warmupFrames--;
            } else {
                this.posVariable.material.uniforms.warmup.value = 0.0;
            }
            // Postura y proximidad
            const prox = this._getProximityScale(this.params.proximity);
            this.posVariable.material.uniforms.proximityScale.value = prox;
            const post = this._getPostureScale(this.params.posture);
            this.posVariable.material.uniforms.postureScale.value.set(post.x, post.y, post.z);
            // Compute
            this.gpuCompute.compute();
            // Render uniforms
            const posTex = this.gpuCompute.getCurrentRenderTarget(this.posVariable).texture;
            this.particles.material.uniforms.posTex.value = posTex;
            this.particles.material.uniforms.time.value = this.time;
            this.particles.material.uniforms.pulseFactor.value = pulseFactor;
        }

        _getProximityScale(label){
            switch(label){
                case 'close': return 0.9;
                case 'medium': return 1.0;
                case 'far': return 1.12;
                default: return 1.0;
            }
        }
        _getPostureScale(label){
            switch(label){
                case 'upright': return {x:1.0,y:1.06,z:1.0};
                case 'leaning': return {x:1.08,y:0.94,z:1.0};
                case 'curled': return {x:0.85,y:0.80,z:0.85};
                case 'expanded': return {x:1.15,y:1.10,z:1.15};
                default: return {x:1,y:1,z:1};
            }
        }

        getParticleSystem(){ return this.particles; }
        getParticleCount(){ return this.particleCount; }
        dispose(){ /* TODO: limpiar render targets */ }
    setDebugMode(on){ if(this.particles) this.particles.material.uniforms.debugMode.value = on?1:0; }

    _prewarmCompute(){
        // Ejecutar varias iteraciones rápidas sin render para estabilizar distribución
        const steps = 25;
        for(let i=0;i<steps;i++){
            const d = 0.016;
            this.time += d;
            // actualizar uniforms mínimos necesarios
            this.velVariable.material.uniforms.delta.value = d;
            this.velVariable.material.uniforms.time.value = this.time;
            this.posVariable.material.uniforms.delta.value = d;
            this.posVariable.material.uniforms.time.value = this.time;
            this.gpuCompute.compute();
        }
        // Ajustar warmup restante proporcionalmente (ya hubo difusión)
        this.warmupFrames = Math.max(0, this.warmupFrames - 60);
    }
    }

    window.GpuAuraSystem = GpuAuraSystem;
})();
