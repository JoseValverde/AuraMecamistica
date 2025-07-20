// Sistema de partículas para el aura
class AuraSystem {
    constructor() {
        this.particles = null;
        this.particleCount = 2000;
        this.positions = new Float32Array(this.particleCount * 3);
        this.velocities = new Float32Array(this.particleCount * 3);
        this.colors = new Float32Array(this.particleCount * 3);
        this.sizes = new Float32Array(this.particleCount);
        
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
        // Generar color base según temperatura
        const baseColorHSL = AuraUtils.getTemperatureColor(this.params.temperature);
        const colorVariations = AuraUtils.generateColorVariations(baseColorHSL, 10);
        
        // Calcular radio base según altura y peso
        const baseRadius = AuraUtils.mapRange(this.params.height, 150, 200, 1.5, 2.5);
        const densityFactor = AuraUtils.mapRange(this.params.weight, 40, 120, 0.7, 1.3);
        
        for (let i = 0; i < this.particleCount; i++) {
            const i3 = i * 3;
            
            // Calcular posición objetivo estructurada (centro de órbita)
            let targetPosition = this.calculateStructuredPosition(i, baseRadius * densityFactor);
            
            // Guardar posición objetivo
            this.targetPositions[i3] = targetPosition.x;
            this.targetPositions[i3 + 1] = targetPosition.y;
            this.targetPositions[i3 + 2] = targetPosition.z;
            
            // Fase inicial aleatoria para cada partícula
            this.particlePhases[i] = Math.random() * Math.PI * 2;
            
            // Radio de órbita individual
            this.orbitRadii[i] = 0.1 + Math.random() * 0.3;
            
            // Posición inicial: cerca del objetivo pero con desplazamiento aleatorio
            const orbitOffset = new THREE.Vector3(
                (Math.random() - 0.5) * this.orbitRadii[i] * 2,
                (Math.random() - 0.5) * this.orbitRadii[i] * 2,
                (Math.random() - 0.5) * this.orbitRadii[i] * 2
            );
            
            this.positions[i3] = targetPosition.x + orbitOffset.x;
            this.positions[i3 + 1] = targetPosition.y + orbitOffset.y;
            this.positions[i3 + 2] = targetPosition.z + orbitOffset.z;
            
            // Velocidades iniciales para órbita
            this.velocities[i3] = (Math.random() - 0.5) * 0.01;
            this.velocities[i3 + 1] = (Math.random() - 0.5) * 0.01;
            this.velocities[i3 + 2] = (Math.random() - 0.5) * 0.01;
            
            // Color de partícula con variación sutil
            const colorIndex = Math.floor(Math.random() * colorVariations.length);
            const color = colorVariations[colorIndex];
            this.colors[i3] = color.r;
            this.colors[i3 + 1] = color.g;
            this.colors[i3 + 2] = color.b;
            
            // Tamaño de partícula variable
            this.sizes[i] = Math.random() * 0.6 + 0.3;
        }
    }
    
    calculateStructuredPosition(index, radius) {
        const particlesPerLayer = Math.floor(this.particleCount / 8); // 8 capas
        const layer = Math.floor(index / particlesPerLayer);
        const indexInLayer = index % particlesPerLayer;
        
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
        // Actualizar parámetros y regenerar partículas si es necesario
        const needsReset = 
            this.params.temperature !== newParams.temperature ||
            this.params.weight !== newParams.weight ||
            this.params.height !== newParams.height ||
            this.params.emotion !== newParams.emotion ||
            this.params.proximity !== newParams.proximity;
            
        this.params = { ...this.params, ...newParams };
        
        if (needsReset) {
            this.resetParticles();
            this.updateBufferAttributes();
        }
        
        AuraUtils.debugLog('Parámetros actualizados', this.params);
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
        
        // Parámetros de movimiento
        const movementSpeed = AuraUtils.mapRange(this.params.movement, 0, 100, 0.5, 3.0);
        const orbitIntensity = AuraUtils.mapRange(this.params.movement, 0, 100, 0.8, 2.5);
        const soundAmplitude = AuraUtils.mapRange(this.params.sound, 0, 100, 0, 0.3);
        const heartPulse = Math.sin(this.pulseTime * Math.PI * 2) * 0.1 + 1;
        
        // Actualizar posiciones objetivo si es necesario
        if (this.time % 10 < deltaTime) { // Cada 10 segundos aproximadamente
            this.updateTargetPositions();
        }
        
        for (let i = 0; i < this.particleCount; i++) {
            const i3 = i * 3;
            
            // Actualizar fase individual de cada partícula
            this.particlePhases[i] += deltaTime * movementSpeed * (0.5 + Math.random() * 0.5);
            
            // Posición objetivo actual
            const targetX = this.targetPositions[i3];
            const targetY = this.targetPositions[i3 + 1];
            const targetZ = this.targetPositions[i3 + 2];
            
            // Radio de órbita dinámico
            const currentOrbitRadius = this.orbitRadii[i] * orbitIntensity;
            
            // Movimiento orbital en múltiples dimensiones
            const orbitX = Math.cos(this.particlePhases[i]) * currentOrbitRadius;
            const orbitY = Math.sin(this.particlePhases[i] * 1.3) * currentOrbitRadius * 0.7;
            const orbitZ = Math.sin(this.particlePhases[i] * 0.8) * currentOrbitRadius;
            
            // Movimiento de alejamiento y acercamiento (respiración)
            const breathPhase = this.time * 0.5 + i * 0.1;
            const breathRadius = Math.sin(breathPhase) * currentOrbitRadius * 0.5;
            
            // Posición final combinada
            let finalX = targetX + orbitX + breathRadius * Math.cos(breathPhase * 2);
            let finalY = targetY + orbitY + breathRadius * Math.sin(breathPhase * 1.7);
            let finalZ = targetZ + orbitZ + breathRadius * Math.cos(breathPhase * 2.3);
            
            // Añadir ruido orgánico
            const noiseTime = this.time * 2 + i * 0.01;
            finalX += Math.sin(noiseTime * 3.1) * 0.05 * movementSpeed;
            finalY += Math.cos(noiseTime * 2.7) * 0.05 * movementSpeed;
            finalZ += Math.sin(noiseTime * 3.5) * 0.05 * movementSpeed;
            
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
    
    updateTargetPositions() {
        // Recalcular posiciones objetivo para variación dinámica
        const baseRadius = AuraUtils.mapRange(this.params.height, 150, 200, 1.5, 2.5);
        const densityFactor = AuraUtils.mapRange(this.params.weight, 40, 120, 0.7, 1.3);
        
        for (let i = 0; i < this.particleCount; i++) {
            const i3 = i * 3;
            const newTarget = this.calculateStructuredPosition(i, baseRadius * densityFactor);
            
            // Rotación lenta de toda la estructura
            const rotationSpeed = 0.1;
            const rotY = this.time * rotationSpeed;
            const rotatedX = newTarget.x * Math.cos(rotY) - newTarget.z * Math.sin(rotY);
            const rotatedZ = newTarget.x * Math.sin(rotY) + newTarget.z * Math.cos(rotY);
            
            this.targetPositions[i3] = rotatedX;
            this.targetPositions[i3 + 1] = newTarget.y;
            this.targetPositions[i3 + 2] = rotatedZ;
        }
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
