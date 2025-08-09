// Sistema de partículas para el aura
class AuraSystem {
    constructor(options = {}) {
        this.particles = null;
        this.particleCount = 2000;
        this.positions = new Float32Array(this.particleCount * 3);
        this.velocities = new Float32Array(this.particleCount * 3);
        this.colors = new Float32Array(this.particleCount * 3);
        this.sizes = new Float32Array(this.particleCount);
        // Radio de esfera de contorno (sincronizado con main.js)
        this.sphereRadius = options.sphereRadius ?? (window.AURA_SPHERE_RADIUS ?? 8); // usa constante global
        
        // Parámetros del aura
        this.params = {
            temperature: 20,
            weight: 70,
            movement: 50,
            height: 170,
            heartRate: 80,
            sound: 30,
            proximity: 'close',
            posture: 'upright',
            emotion: 'reflective'
        };
        
        // Estado de animación
        this.time = 0;
        this.pulseTime = 0;
        this.morphState = 0; // 0: espiral, 0.5: elipse, 1: amorfo
        
        // Posiciones objetivo para cada partícula (estructura base)
        this.targetPositions = new Float32Array(this.particleCount * 3);
        // Fases individuales para cada partícula
        this.particlePhases = new Float32Array(this.particleCount);
        // Radios de órbita individuales
        this.orbitRadii = new Float32Array(this.particleCount);
    // Semilla por partícula para variaciones emocionales
    this.emotionSeeds = new Float32Array(this.particleCount);
    for (let i = 0; i < this.particleCount; i++) this.emotionSeeds[i] = Math.random();
    // Perfiles emocionales (transición suave)
    this.currentEmotionProfile = this.getEmotionProfile(this.params.emotion);
    this.targetEmotionProfile = { ...this.currentEmotionProfile };
    this.emotionTransitionT = 1; // 1 => sin transición en curso
    this.EMOTION_TRANSITION_DURATION = 1.8; // segundos para fundido
    // Fase acumulativa para modulación emocional (evita saltos al cambiar waveSpeed)
    this.emotionPhase = 0;
    // Suavizado de intensidad orbital (para transiciones de emoción)
    this.smoothedOrbitIntensity = null;
    // Ángulo de rotación global acumulativo (evita salto proporcional al tiempo al cambiar velocidad)
    this.globalRotationAngle = 0;
    this.smoothedRotationSpeed = null; // para suavizar cambios de velocidad de rotación
        
        this.init();
    }
    
    init() {
        // Crear geometría y material para partículas
        const geometry = new THREE.BufferGeometry();
        
        // Inicializar posiciones y propiedades
        this.resetParticles();
        
        // Asignar atributos a la geometría
        geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
        
        // Crear material con shader personalizado
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                pointTexture: { value: this.createParticleTexture() }
            },
            vertexShader: this.getVertexShader(),
            fragmentShader: this.getFragmentShader(),
            blending: THREE.AdditiveBlending,
            depthTest: false,
            transparent: true,
            vertexColors: true
        });
        
    // Crear sistema de partículas
    this.particles = new THREE.Points(geometry, material);
        AuraUtils.debugLog('Sistema de partículas inicializado', {
            particleCount: this.particleCount,
            morphState: this.morphState
        });
    }
    
    createParticleTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        
        const context = canvas.getContext('2d');
        const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        context.fillStyle = gradient;
        context.fillRect(0, 0, 64, 64);
        
        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }
    
    resetParticles() {
        // Colores base según temperatura
        const baseColorHSL = AuraUtils.getTemperatureColor(this.params.temperature);
        const colorVariations = AuraUtils.generateColorVariations(baseColorHSL, 10);
        const N = this.particleCount;
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));
        for (let i = 0; i < N; i++) {
            const i3 = i * 3;
            // Fibonacci sphere
            const k = (i + 0.5);
            const y = 1 - (2 * k) / N;
            const r = Math.sqrt(Math.max(0, 1 - y * y));
            const phi = i * goldenAngle;
            const x = Math.cos(phi) * r;
            const z = Math.sin(phi) * r;
            const targetPosition = new THREE.Vector3(x, y, z).multiplyScalar(this.sphereRadius);
            this.targetPositions[i3] = targetPosition.x;
            this.targetPositions[i3 + 1] = targetPosition.y;
            this.targetPositions[i3 + 2] = targetPosition.z;
            // Fase y órbita
            this.particlePhases[i] = Math.random() * Math.PI * 2;
            this.orbitRadii[i] = 0.15 + Math.random() * 0.25;
            // Pequeño jitter tangencial inicial
            const radial = targetPosition.clone().normalize();
            const tangentA = new THREE.Vector3(-radial.z, 0, radial.x).normalize();
            const tangentB = new THREE.Vector3().crossVectors(radial, tangentA).normalize();
            const jitter = tangentA.multiplyScalar((Math.random() - 0.5) * 0.4)
                .add(tangentB.multiplyScalar((Math.random() - 0.5) * 0.4));
            const start = radial.multiplyScalar(this.sphereRadius).add(jitter);
            this.positions[i3] = start.x;
            this.positions[i3 + 1] = start.y;
            this.positions[i3 + 2] = start.z;
            // Velocidad base mínima
            this.velocities[i3] = (Math.random() - 0.5) * 0.003;
            this.velocities[i3 + 1] = (Math.random() - 0.5) * 0.003;
            this.velocities[i3 + 2] = (Math.random() - 0.5) * 0.003;
            // Color y tamaño
            const colorIndex = Math.floor(Math.random() * colorVariations.length);
            const color = colorVariations[colorIndex];
            this.colors[i3] = color.r;
            this.colors[i3 + 1] = color.g;
            this.colors[i3 + 2] = color.b;
            this.sizes[i] = Math.random() * 0.5 + 0.35;
        }
    }
    
    calculateStructuredPosition(index, radius) {
        const particlesPerLayer = Math.floor(this.particleCount / 8); // 8 capas
        const layer = Math.floor(index / particlesPerLayer);
        const indexInLayer = index % particlesPerLayer;
            const newTarget = new THREE.Vector3(
                this.targetPositions[i3],
                this.targetPositions[i3 + 1],
                this.targetPositions[i3 + 2]
            );
        // Ángulo base para esta partícula
        const baseAngle = (indexInLayer / particlesPerLayer) * Math.PI * 2;
        const layerRadius = radius * (0.3 + layer * 0.15); // Capas concéntricas
        
        let position;
        
        switch(this.params.emotion) {
            case 'impulsive':
                // Forma de estrella irregular con múltiples brazos
                const starArms = 8;
                const armAngle = Math.floor(indexInLayer / (particlesPerLayer / starArms));
                const armProgress = (indexInLayer % (particlesPerLayer / starArms)) / (particlesPerLayer / starArms);
                const starRadius = layerRadius * (0.5 + armProgress * 1.2);
                const starAngle = baseAngle + (armAngle * (Math.PI * 2 / starArms));
                
                position = new THREE.Vector3(
                    Math.cos(starAngle) * starRadius,
                    Math.sin(starAngle * 1.3) * layerRadius * 0.6,
                    Math.sin(starAngle) * starRadius
                );
                break;
                
            case 'expansive':
                // Forma de toro (donut) expandido
                const torusRadius = layerRadius;
                const tubeRadius = radius * 0.4;
                const u = baseAngle;
                const v = (layer / 8) * Math.PI * 2;
                
                position = new THREE.Vector3(
                    (torusRadius + tubeRadius * Math.cos(v)) * Math.cos(u),
                    tubeRadius * Math.sin(v),
                    (torusRadius + tubeRadius * Math.cos(v)) * Math.sin(u)
                );
                break;
                
            case 'contained':
                // Espiral doble muy cerrada (DNA-like)
                const spiralTurns = 4;
                const spiralAngle = baseAngle * spiralTurns + (layer * Math.PI / 4);
                const spiralRadius = layerRadius * 0.6;
                const spiralHeight = radius * 0.8;
                
                const isSecondHelix = index % 2 === 0;
                const helixOffset = isSecondHelix ? Math.PI : 0;
                
                position = new THREE.Vector3(
                    Math.cos(spiralAngle + helixOffset) * spiralRadius,
                    (indexInLayer / particlesPerLayer - 0.5) * spiralHeight,
                    Math.sin(spiralAngle + helixOffset) * spiralRadius
                );
                break;
                
            default: // 'reflective'
                // Fibonacci spiral (golden ratio)
                const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~137.5 degrees
                const fibAngle = index * goldenAngle;
                const fibRadius = Math.sqrt(index) * radius * 0.1;
                
                position = new THREE.Vector3(
                    Math.cos(fibAngle) * fibRadius,
                    (index / this.particleCount - 0.5) * radius * 1.2,
                    Math.sin(fibAngle) * fibRadius
                );
                
                // Añadir capas esféricas para más densidad
                if (layer > 0) {
                    const sphereRadius = layerRadius * 0.8;
                    const phi = Math.acos(1 - 2 * indexInLayer / particlesPerLayer);
                    const theta = Math.sqrt(particlesPerLayer * Math.PI) * phi;
                    
                    position.add(new THREE.Vector3(
                        Math.sin(phi) * Math.cos(theta) * sphereRadius * 0.3,
                        Math.cos(phi) * sphereRadius * 0.3,
                        Math.sin(phi) * Math.sin(theta) * sphereRadius * 0.3
                    ));
                }
                break;
        }
        
        // Ajustar según proximidad (mantener escala)
        const proximityScale = this.getProximityScale();
        position.multiplyScalar(proximityScale);
        
        // Ajustar según postura
        this.applyPostureTransform(position);
        
        return position;
    }
    
    applyPostureTransform(position) {
        switch(this.params.posture) {
            case 'hunched':
                // Comprimir verticalmente y expandir horizontalmente
                position.y *= 0.6;
                position.x *= 1.2;
                position.z *= 1.2;
                break;
                
            case 'relaxed':
                // Forma más suave y expandida
                position.y *= 0.8;
                position.x *= 1.1;
                position.z *= 1.1;
                break;
                
            case 'tense':
                // Más estrecho y alto
                position.y *= 1.3;
                position.x *= 0.8;
                position.z *= 0.8;
                break;
                
            default: // 'upright'
                // Mantener proporciones originales
                break;
        }
    }
    
    getProximityScale() {
        switch(this.params.proximity) {
            case 'isolated': return 1.3;
            case 'surrounded': return 0.7;
            default: return 1.0; // 'close'
        }
    }
    
    updateParams(newParams) {
        const oldParams = { ...this.params };
        this.params = { ...this.params, ...newParams };
        
        // Solo resetear si cambian parámetros que afectarían distribución base (mantenemos emoción en la misma esfera)
        const structuralChanges = 
            oldParams.proximity !== newParams.proximity ||  // Escala general
            oldParams.posture !== newParams.posture;        // Transformación de forma global
            
        // Estos parámetros solo afectan colores o necesitan recalcular posiciones objetivo
        const needsTargetUpdate =
            oldParams.temperature !== newParams.temperature ||  // Solo afecta colores
            oldParams.weight !== newParams.weight ||           // Afecta densidad/radio
            oldParams.height !== newParams.height;             // Afecta tamaño
        
        if (oldParams.emotion !== newParams.emotion) {
            // Iniciar transición hacia nuevo perfil
            this.targetEmotionProfile = this.getEmotionProfile(this.params.emotion);
            this.emotionTransitionT = 0; // reiniciar progreso
        }
        if (structuralChanges) {
            // Reset completo: nueva distribución de partículas
            this.resetParticles();
            this.updateBufferAttributes();
            AuraUtils.debugLog('Reset estructural de partículas', { reason: 'structural changes' });
        } else if (needsTargetUpdate) {
            // Solo actualizar posiciones objetivo sin resetear partículas actuales
            this.updateTargetPositionsOnly();
            AuraUtils.debugLog('Actualización de objetivos', { reason: 'target update' });
        }
        
        // Los parámetros de movimiento, sonido y heartRate no necesitan ningún reset
        // Se aplican directamente en el loop de animación
        
        AuraUtils.debugLog('Parámetros actualizados', {
            structural: structuralChanges,
            targetUpdate: needsTargetUpdate,
            params: this.params
        });
    }

    getEmotionProfile(emotion) {
        switch (emotion) {
            case 'impulsive':
                return {
                    orbitMultiplier: 1.4,
                    noiseMultiplier: 2.2,
                    tangentialWaveAmp: 0.28,
                    waveSpeed: 2.2,
                    radialJitter: 0.20,
                    shellThickness: 0.35,
                    pulseMultiplier: 1.25
                };
            case 'expansive':
                return {
                    orbitMultiplier: 1.2,
                    noiseMultiplier: 1.3,
                    tangentialWaveAmp: 0.18,
                    waveSpeed: 1.1,
                    radialJitter: 0.15,
                    shellThickness: 0.25,
                    pulseMultiplier: 1.15
                };
            case 'contained':
                return {
                    orbitMultiplier: 0.7,
                    noiseMultiplier: 0.6,
                    tangentialWaveAmp: 0.10,
                    waveSpeed: 0.9,
                    radialJitter: 0.05,
                    shellThickness: 0.05,
                    pulseMultiplier: 0.85
                };
            case 'reflective':
            default:
                return {
                    orbitMultiplier: 0.9,
                    noiseMultiplier: 0.8,
                    tangentialWaveAmp: 0.12,
                    waveSpeed: 0.6,
                    radialJitter: 0.07,
                    shellThickness: 0.12,
                    pulseMultiplier: 1.0
                };
        }
    }
    
    updateTargetPositionsOnly() {
        // Solo refrescar colores (las posiciones ya están fijadas a la esfera)
        const baseColorHSL = AuraUtils.getTemperatureColor(this.params.temperature);
        const colorVariations = AuraUtils.generateColorVariations(baseColorHSL, 10);
        for (let i = 0; i < this.particleCount; i++) {
            const i3 = i * 3;
            const colorIndex = Math.floor(Math.random() * colorVariations.length);
            const newColor = colorVariations[colorIndex];
            this.colors[i3] += (newColor.r - this.colors[i3]) * 0.08;
            this.colors[i3 + 1] += (newColor.g - this.colors[i3 + 1]) * 0.08;
            this.colors[i3 + 2] += (newColor.b - this.colors[i3 + 2]) * 0.08;
        }
        this.updateBufferAttributes();
    }
    
    updateBufferAttributes() {
        if (!this.particles) return;
        
        const geometry = this.particles.geometry;
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.color.needsUpdate = true;
        geometry.attributes.size.needsUpdate = true;
    }
    
    animate(deltaTime) {
        if (!this.particles) return;
        
        this.time += deltaTime;
        this.pulseTime += deltaTime * (this.params.heartRate / 60);
        
        // Actualizar uniforms del shader
        this.particles.material.uniforms.time.value = this.time;
        
        // Interpolación de perfil emocional
        if (this.emotionTransitionT < 1) {
            this.emotionTransitionT += deltaTime / this.EMOTION_TRANSITION_DURATION;
            if (this.emotionTransitionT > 1) this.emotionTransitionT = 1;
        }
        const tEase = this.emotionTransitionT < 1 ? (1 - Math.cos(this.emotionTransitionT * Math.PI)) / 2 : 1; // easeInOutCosine
        const blend = (a, b) => a + (b - a) * tEase;
    const activeProfile = {
            orbitMultiplier: blend(this.currentEmotionProfile.orbitMultiplier, this.targetEmotionProfile.orbitMultiplier),
            noiseMultiplier: blend(this.currentEmotionProfile.noiseMultiplier, this.targetEmotionProfile.noiseMultiplier),
            tangentialWaveAmp: blend(this.currentEmotionProfile.tangentialWaveAmp, this.targetEmotionProfile.tangentialWaveAmp),
            waveSpeed: blend(this.currentEmotionProfile.waveSpeed, this.targetEmotionProfile.waveSpeed),
            radialJitter: blend(this.currentEmotionProfile.radialJitter, this.targetEmotionProfile.radialJitter),
            shellThickness: blend(this.currentEmotionProfile.shellThickness, this.targetEmotionProfile.shellThickness),
            pulseMultiplier: blend(this.currentEmotionProfile.pulseMultiplier, this.targetEmotionProfile.pulseMultiplier)
        };
        // Cuando termina la transición fijar el perfil actual
        if (this.emotionTransitionT === 1 && this.currentEmotionProfile !== this.targetEmotionProfile) {
            this.currentEmotionProfile = { ...this.targetEmotionProfile };
        }
        // Parámetros de movimiento base
        const movementSpeedBase = AuraUtils.mapRange(this.params.movement, 0, 100, 0.5, 3.0);
        const orbitIntensityBase = AuraUtils.mapRange(this.params.movement, 0, 100, 0.8, 2.5);
        const soundAmplitude = AuraUtils.mapRange(this.params.sound, 0, 100, 0, 0.3);
        const heartPulse = (Math.sin(this.pulseTime * Math.PI * 2) * 0.1 + 1) * activeProfile.pulseMultiplier;
        const movementSpeed = movementSpeedBase * activeProfile.orbitMultiplier;
    const orbitIntensity = orbitIntensityBase * activeProfile.orbitMultiplier;
    // Inicializar suavizado si es la primera vez
    if (this.smoothedOrbitIntensity === null) this.smoothedOrbitIntensity = orbitIntensity;
    // Lerp exponencial para cambio suave (evita salto de volumen al cambiar emoción)
    const smoothingFactor = 0.01; // 0.1 ~ responde en ~10-12 frames
    this.smoothedOrbitIntensity += (orbitIntensity - this.smoothedOrbitIntensity) * smoothingFactor;
        
    // Rotación continua incremental (elimina salto grande al cambiar emoción)
    const rotationSpeedTarget = 0.05 * activeProfile.orbitMultiplier; // velocidad objetivo
    if (this.smoothedRotationSpeed === null) this.smoothedRotationSpeed = rotationSpeedTarget;
    const rotSmoothFactor = 0.15; // suavizado de velocidad angular
    this.smoothedRotationSpeed += (rotationSpeedTarget - this.smoothedRotationSpeed) * rotSmoothFactor;
    this.globalRotationAngle += deltaTime * this.smoothedRotationSpeed;
    const globalRotY = this.globalRotationAngle;
    // Avanzar fase emocional acumulativa (independiente del cambio de waveSpeed)
    this.emotionPhase += deltaTime * activeProfile.waveSpeed;
        
        for (let i = 0; i < this.particleCount; i++) {
            const i3 = i * 3;
            
            // Actualizar fase individual de cada partícula
            this.particlePhases[i] += deltaTime * movementSpeed * (0.5 + Math.random() * 0.5);
            
            // Posición objetivo actual con rotación continua
            const baseTargetX = this.targetPositions[i3];
            const baseTargetY = this.targetPositions[i3 + 1];
            const baseTargetZ = this.targetPositions[i3 + 2];
            
            // Aplicar rotación suave y continua a la posición objetivo
            const targetX = baseTargetX * Math.cos(globalRotY) - baseTargetZ * Math.sin(globalRotY);
            const targetY = baseTargetY;
            const targetZ = baseTargetX * Math.sin(globalRotY) + baseTargetZ * Math.cos(globalRotY);
            
            // Radio de órbita dinámico
            const currentOrbitRadius = this.orbitRadii[i] * this.smoothedOrbitIntensity;
            
            // Movimiento orbital en múltiples dimensiones
            const orbitX = Math.cos(this.particlePhases[i]) * currentOrbitRadius;
            const orbitY = Math.sin(this.particlePhases[i] * 1.3) * currentOrbitRadius * 0.7;
            const orbitZ = Math.sin(this.particlePhases[i] * 0.8) * currentOrbitRadius;
            
            // Movimiento de alejamiento y acercamiento (respiración)
            const breathPhase = this.time * 0.5 + i * 0.1;
            const breathRadius = Math.sin(breathPhase) * currentOrbitRadius * 0.5;
            
            // Posición base combinada previa a modulación emocional
            let finalX = targetX + orbitX + breathRadius * Math.cos(breathPhase * 2);
            let finalY = targetY + orbitY + breathRadius * Math.sin(breathPhase * 1.7);
            let finalZ = targetZ + orbitZ + breathRadius * Math.cos(breathPhase * 2.3);

            // Modulación emocional (tangencial + radial) manteniendo superficie
            const dirLen = Math.sqrt(targetX*targetX + targetY*targetY + targetZ*targetZ) || 1;
            const nx = targetX / dirLen;
            const ny = targetY / dirLen;
            const nz = targetZ / dirLen;
            // Tangentes ortogonales
            let tx = -nz, ty = 0, tz = nx; // primer tangente aproximada
            const tLen = Math.sqrt(tx*tx + ty*ty + tz*tz) || 1; tx/=tLen; ty/=tLen; tz/=tLen;
            // segunda tangente
            let ux = ny*tz - nz*ty;
            let uy = nz*tx - nx*tz;
            let uz = nx*ty - ny*tx;
            const uLen = Math.sqrt(ux*ux + uy*uy + uz*uz) || 1; ux/=uLen; uy/=uLen; uz/=uLen;
            const seed = this.emotionSeeds[i];
            const wavePhase = this.emotionPhase + seed * Math.PI * 2; // fase continua sin saltos
            const tangentialA = Math.sin(wavePhase) * activeProfile.tangentialWaveAmp;
            const tangentialB = Math.cos(wavePhase * 0.7 + seed) * activeProfile.tangentialWaveAmp * 0.7;
            finalX += tx * tangentialA + ux * tangentialB;
            finalY += ty * tangentialA + uy * tangentialB;
            finalZ += tz * tangentialA + uz * tangentialB;
            // Jitter radial controlado
            const radialWave = Math.sin(wavePhase * 1.3) * activeProfile.radialJitter;
            // Para 'impulsive' añadir destellos rápidos (spikes)
            if (this.params.emotion === 'impulsive') {
                const spike = Math.pow(Math.max(0, Math.sin(this.time * 10 + seed * 20)), 3) * activeProfile.shellThickness;
                finalX += nx * spike;
                finalY += ny * spike;
                finalZ += nz * spike;
            }
            // Proyección para mantener superficie con grosor limitado
            const desiredRadius = this.sphereRadius + radialWave * activeProfile.shellThickness;
            const fLen = Math.sqrt(finalX*finalX + finalY*finalY + finalZ*finalZ) || 1;
            const scale = desiredRadius / fLen;
            finalX *= scale; finalY *= scale; finalZ *= scale;
            
            // Añadir ruido orgánico
            const noiseTime = this.time * 2 + i * 0.01;
            finalX += Math.sin(noiseTime * 3.1) * 0.05 * movementSpeed * activeProfile.noiseMultiplier;
            finalY += Math.cos(noiseTime * 2.7) * 0.05 * movementSpeed * activeProfile.noiseMultiplier;
            finalZ += Math.sin(noiseTime * 3.5) * 0.05 * movementSpeed * activeProfile.noiseMultiplier;
            
            // Interpolación suave hacia la nueva posición
            const lerpFactor = 0.1;
            this.positions[i3] += (finalX - this.positions[i3]) * lerpFactor;
            this.positions[i3 + 1] += (finalY - this.positions[i3 + 1]) * lerpFactor;
            this.positions[i3 + 2] += (finalZ - this.positions[i3 + 2]) * lerpFactor;
            
            // Efecto de sonido en el tamaño
            const baseSizeForParticle = 0.3 + (i % 10) * 0.03;
            const soundEffect = soundAmplitude * Math.sin(this.time * 8 + i * 0.2);
            this.sizes[i] = baseSizeForParticle * (1 + soundEffect) * heartPulse;
            
            // Fuerza de atracción hacia el centro (evita que se alejen demasiado)
            const distanceFromTarget = Math.sqrt(
                (this.positions[i3] - targetX) ** 2 +
                (this.positions[i3 + 1] - targetY) ** 2 +
                (this.positions[i3 + 2] - targetZ) ** 2
            );
            
            // Si la partícula se aleja mucho, aplicar fuerza de retorno
            const maxDistance = currentOrbitRadius * 3;
            if (distanceFromTarget > maxDistance) {
                const returnForce = 0.05;
                this.positions[i3] += (targetX - this.positions[i3]) * returnForce;
                this.positions[i3 + 1] += (targetY - this.positions[i3 + 1]) * returnForce;
                this.positions[i3 + 2] += (targetZ - this.positions[i3 + 2]) * returnForce;
            }
        }
        
        this.updateBufferAttributes();
    }
    
    getVertexShader() {
        return `
            attribute float size;
            varying vec3 vColor;
            uniform float time;
            
            void main() {
                vColor = color;
                
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                
                // Efecto de pulsación suave
                float pulse = sin(time * 2.0 + position.x * 0.1) * 0.2 + 1.0;
                
                gl_PointSize = size * pulse * (300.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `;
    }
    
    getFragmentShader() {
        return `
            uniform sampler2D pointTexture;
            varying vec3 vColor;
            
            void main() {
                gl_FragColor = vec4(vColor, 1.0);
                
                vec4 textureColor = texture2D(pointTexture, gl_PointCoord);
                gl_FragColor = gl_FragColor * textureColor;
                
                // Añadir brillo suave
                float brightness = dot(vColor, vec3(0.299, 0.587, 0.114));
                gl_FragColor.rgb += brightness * 0.3;
            }
        `;
    }
    
    getParticleSystem() {
        return this.particles;
    }
    
    dispose() {
        if (this.particles) {
            this.particles.geometry.dispose();
            this.particles.material.dispose();
        }
    }
}

// Hacer disponible globalmente
window.AuraSystem = AuraSystem;
