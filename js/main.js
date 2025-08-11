// Aplicación principal
class AuraVisualization {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.auraSystem = null;
        this.animationId = null;
    this.baseAngles = null; // Rotación inicial para mostrar valores relativos 0°,0°
    this.environmentSphere = null; // Esfera envolvente
        
        // Elementos del DOM
        this.canvas = document.getElementById('aura-canvas');
        this.loadingElement = document.getElementById('loading');
        
        // Panel de información
        this.infoPanel = document.getElementById('info-panel');
        this.infoToggle = document.getElementById('info-toggle');
        this.infoElements = {
            cameraPos: document.getElementById('camera-pos'),
            cameraDist: document.getElementById('camera-dist'),
            cameraRot: document.getElementById('camera-rot'),
            temp: document.getElementById('info-temp'),
            movement: document.getElementById('info-movement'),
            emotion: document.getElementById('info-emotion'),
            heartrate: document.getElementById('info-heartrate'),
            fps: document.getElementById('info-fps'),
            particles: document.getElementById('info-particles'),
            time: document.getElementById('info-time'),
            orbitalSpeed: document.getElementById('info-orbital-speed')
        };
        
        // Estado del panel
        this.infoPanelCollapsed = false;
        this.frameCount = 0;
        this.lastTime = Date.now();
        
        // Controles UI
        this.controls_ui = {
            temperature: document.getElementById('temperature'),
            weight: document.getElementById('weight'),
            movement: document.getElementById('movement'),
            height: document.getElementById('height'),
            heartrate: document.getElementById('heartrate'),
            sound: document.getElementById('sound'),
            proximity: document.getElementById('proximity'),
            posture: document.getElementById('posture'),
            emotion: document.getElementById('emotion')
        };
        
        // Valores mostrados
        this.valueDisplays = {
            temperature: document.getElementById('temp-value'),
            weight: document.getElementById('weight-value'),
            movement: document.getElementById('movement-value'),
            height: document.getElementById('height-value'),
            heartrate: document.getElementById('heartrate-value'),
            sound: document.getElementById('sound-value')
        };
        
        this.init();
    }
    
    async init() {
        try {
            this.initThreeJS();
            this.initAuraSystem();
            this.initControls();
            this.initEventListeners();
            
            // Ocultar loading y empezar animación
            this.loadingElement.style.display = 'none';
            this.animate();
            
            console.log('✨ Visualización de Aura iniciada correctamente');
            
        } catch (error) {
            console.error('❌ Error inicializando la visualización:', error);
            this.showError('Error al inicializar la visualización 3D');
        }
    }
    
    initThreeJS() {
        // Crear escena
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);
        
        // Añadir niebla sutil para profundidad
        this.scene.fog = new THREE.Fog(0x000000, 10, 50);
        
        // Configurar cámara
        const container = document.getElementById('canvas-container');
        const aspect = container.clientWidth / container.clientHeight;
        
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    // Colocar la cámara a un radio suficiente para órbita libre (horizontal y vertical)
    this.camera.position.set(0,0.1,0.1);
        
        // Configurar renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true
        });
        
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        
        // Configurar controles de órbita con configuración más restrictiva
        this.controls = new THREE.OrbitControls(this.camera, this.canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enableZoom = true;
    this.controls.enablePan = true; // Evitar desplazamiento lateral que movería el centro
        this.controls.enableRotate = true;
    // Eliminar límite superior de zoom (permitir alejarse libremente)
    this.controls.maxDistance = Infinity;
        this.controls.minDistance = 0;
        
    // Permitir rotación vertical y horizontal (evitar pasar polos exactos)
    this.controls.minPolarAngle = 0.2;             // Límite superior (0 sería polo)
    this.controls.maxPolarAngle = Math.PI - 0.2;   // Límite inferior (π sería polo opuesto)
        
        // Configuraciones adicionales para evitar desplazamiento
        this.controls.screenSpacePanning = false; // Desactivar panning en espacio de pantalla
        this.controls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: null // Desactivar botón derecho para evitar pan
        };
        
        // Fijar el objetivo (target) al centro
        this.controls.target.set(0, 0, 0);
        this.controls.update();
        
    // Guardar referencia al target original (centro estable)
    this.originalTarget = new THREE.Vector3(0, 0, 0);
        
        console.log('🎯 Controles configurados - Pan:', this.controls.enablePan, 'Target:', this.controls.target);

        // Añadir esfera envolvente centrada en la cámara (dome)
        this.addEnvironmentSphere();
        // Asegurar que la cámara (con la esfera hija) esté en la escena
        if (!this.scene.children.includes(this.camera)) {
            this.scene.add(this.camera);
        }
        
        // Añadir iluminación ambiental sutil
        const ambientLight = new THREE.AmbientLight(0x404040, 0.1);
        this.scene.add(ambientLight);
        
        // Alinear orientación inicial EXACTAMENTE igual que en reset
        if (!this.initialCameraRadius) this.initialCameraRadius = 0.14;
        if (typeof this.setCameraOrientationDeg === 'function') {
            this.setCameraOrientationDeg(0, 90, this.initialCameraRadius);
        }

        AuraUtils.debugLog('Three.js inicializado', {
            resolution: `${container.clientWidth}x${container.clientHeight}`,
            pixelRatio: this.renderer.getPixelRatio()
        });
    }

    addEnvironmentSphere() {
        if (this.environmentSphere) return; // evitar duplicados
        const radius = window.AURA_SPHERE_RADIUS; // valor centralizado
        const sphereGeo = new THREE.SphereGeometry(radius, 32, 24);
        const wireGeo = new THREE.WireframeGeometry(sphereGeo);
        const material = new THREE.LineBasicMaterial({
            color: 0x4fa3ff,
            transparent: true,
            opacity: 0.35,
            depthWrite: false,
            depthTest: false
        });
        this.environmentSphere = new THREE.LineSegments(wireGeo, material);
        // Añadir a la escena (seguirá la posición de la cámara en animate sin rotar con ella)
        this.environmentSphere.frustumCulled = false; // evitar que desaparezca por culling
    this.environmentSphere.position.set(0,0,0); // fija en el origen
    this.scene.add(this.environmentSphere);
    }
    
    initAuraSystem() {
        const gpuReady = window.AURA_USE_GPU && window.GpuAuraSystem && window.GPUComputationRenderer;
        if (gpuReady) {
            try {
                this.auraSystem = new GpuAuraSystem({ sphereRadius: window.AURA_SPHERE_RADIUS, renderer: this.renderer });
                console.log('🧪 Modo GPU activado');
            } catch (e) {
                console.warn('Fallo inicializando GPU, usando CPU:', e);
                this.auraSystem = new AuraSystem({ sphereRadius: window.AURA_SPHERE_RADIUS });
            }
        } else {
            if (window.AURA_USE_GPU) console.warn('GPU no disponible, fallback CPU');
            this.auraSystem = new AuraSystem({ sphereRadius: window.AURA_SPHERE_RADIUS });
        }
        const particleSystem = this.auraSystem.getParticleSystem();
        if (particleSystem) {
            this.scene.add(particleSystem);
            AuraUtils.debugLog('Sistema de aura añadido a la escena');
        } else {
            throw new Error('No se pudo crear el sistema de partículas');
        }
    }
    
    initControls() {
        // Configurar valores iniciales de los controles
        this.updateDisplayValues();
        
        // Aplicar parámetros iniciales al sistema de aura
        this.updateAuraParameters();
    }
    
    initEventListeners() {
    // Controles de rango (sliders)
        Object.keys(this.controls_ui).forEach(key => {
            const control = this.controls_ui[key];
            if (control) {
                control.addEventListener('input', () => {
                    this.updateDisplayValues();
                    this.updateAuraParameters();
                });
            }
        });

        const resetBtn = document.getElementById('reset-btn');
        const saveBtn = document.getElementById('save-btn');
        
        resetBtn?.addEventListener('click', () => this.resetToDefaults());
        saveBtn?.addEventListener('click', () => this.saveCurrentAura());
        
        // Panel de información
        this.infoToggle?.addEventListener('click', () => this.toggleInfoPanel());
        
        // Redimensionar ventana
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Atajos de teclado
        window.addEventListener('keydown', (event) => {
            switch(event.code) {
                case 'Space':
                    event.preventDefault();
                    this.toggleAnimation();
                    break;
                case 'KeyR':
                    if (event.ctrlKey) {
                        event.preventDefault();
                        this.resetToDefaults();
                    }
                    break;
            }
        });
    }
    
    updateDisplayValues() {
        // Actualizar valores mostrados en la UI
        const temp = this.controls_ui.temperature?.value;
        const weight = this.controls_ui.weight?.value;
        const movement = this.controls_ui.movement?.value;
        const height = this.controls_ui.height?.value;
        const heartrate = this.controls_ui.heartrate?.value;
        const sound = this.controls_ui.sound?.value;
        
        if (this.valueDisplays.temperature && temp) {
            const numeric = parseFloat(temp);
            const label = numeric >= 42 ? `${numeric}°C (máx)` : `${numeric}°C`;
            this.valueDisplays.temperature.textContent = label;
        }
        if (this.valueDisplays.weight && weight) {
            this.valueDisplays.weight.textContent = `${weight}kg`;
        }
        if (this.valueDisplays.movement && movement) {
            this.valueDisplays.movement.textContent = `${movement}%`;
        }
        if (this.valueDisplays.height && height) {
            this.valueDisplays.height.textContent = `${height}cm`;
        }
        if (this.valueDisplays.heartrate && heartrate) {
            this.valueDisplays.heartrate.textContent = `${heartrate}bpm`;
        }
        if (this.valueDisplays.sound && sound) {
            this.valueDisplays.sound.textContent = `${sound}%`;
        }
    }
    
    updateAuraParameters() {
        if (!this.auraSystem) return;
        
        const params = {
            temperature: parseFloat(this.controls_ui.temperature?.value || 20),
            weight: parseFloat(this.controls_ui.weight?.value || 70),
            movement: parseFloat(this.controls_ui.movement?.value || 50),
            height: parseFloat(this.controls_ui.height?.value || 170),
            heartRate: parseFloat(this.controls_ui.heartrate?.value || 80),
            sound: parseFloat(this.controls_ui.sound?.value || 30),
            proximity: this.controls_ui.proximity?.value || 'close',
            posture: this.controls_ui.posture?.value || 'upright',
            emotion: this.controls_ui.emotion?.value || 'reflective'
        };
        
        this.auraSystem.updateParams(params);
    }
    
    resetToDefaults() {
        // Restaurar valores por defecto
        if (this.controls_ui.temperature) this.controls_ui.temperature.value = 20;
        if (this.controls_ui.weight) this.controls_ui.weight.value = 70;
        if (this.controls_ui.movement) this.controls_ui.movement.value = 50;
        if (this.controls_ui.height) this.controls_ui.height.value = 170;
        if (this.controls_ui.heartrate) this.controls_ui.heartrate.value = 80;
        if (this.controls_ui.sound) this.controls_ui.sound.value = 30;
        if (this.controls_ui.proximity) this.controls_ui.proximity.value = 'close';
        if (this.controls_ui.posture) this.controls_ui.posture.value = 'upright';
        if (this.controls_ui.emotion) this.controls_ui.emotion.value = 'reflective';
        
        this.updateDisplayValues();
        this.updateAuraParameters();
        
    // Resetear cámara a la posición orbital inicial (radio y ligera elevación)
    this.setCameraOrientationDeg(0, 90, this.initialCameraRadius);
    // El target permanece en el centro
        this.controls.update();
        
        console.log('🔄 Parámetros restaurados a valores por defecto');
    }
    
    toggleInfoPanel() {
        this.infoPanelCollapsed = !this.infoPanelCollapsed;
        
        if (this.infoPanelCollapsed) {
            this.infoPanel.classList.add('collapsed');
            this.infoToggle.textContent = '📊';
        } else {
            this.infoPanel.classList.remove('collapsed');
            this.infoToggle.textContent = '×';
        }
    }
    
    updateInfoPanel() {
        if (this.infoPanelCollapsed) return;
        
        // Actualizar información de cámara
        const camPos = this.camera.position;
        if (this.infoElements.cameraPos) {
            this.infoElements.cameraPos.textContent = 
                `${camPos.x.toFixed(1)}, ${camPos.y.toFixed(1)}, ${camPos.z.toFixed(1)}`;
        }
        
        const distance = Math.sqrt(camPos.x * camPos.x + camPos.y * camPos.y + camPos.z * camPos.z);
        if (this.infoElements.cameraDist) {
            this.infoElements.cameraDist.textContent = distance.toFixed(1);
        }
        
        // Calcular rotación aproximada
        let rawRotY = Math.atan2(camPos.x, camPos.z) * (180 / Math.PI);
        let rawRotX = Math.atan2(camPos.y, Math.sqrt(camPos.x * camPos.x + camPos.z * camPos.z)) * (180 / Math.PI);
        // Inicializar ángulos base una vez
        if (!this.baseAngles) {
            this.baseAngles = { x: rawRotX, y: rawRotY };
        }
        // Ángulos relativos para mostrar 0°,0° en orientación inicial
        let relX = rawRotX - this.baseAngles.x;
        let relY = rawRotY - this.baseAngles.y;
        // Normalizar a rango [-180,180]
        relX = ((relX + 180) % 360) - 180;
        relY = ((relY + 180) % 360) - 180;
        if (this.infoElements.cameraRot) {
            this.infoElements.cameraRot.textContent = `${relX.toFixed(0)}°, ${relY.toFixed(0)}°`;
        }
        
        // Actualizar configuración actual
        if (this.infoElements.temp) {
            const tVal = parseFloat(this.controls_ui.temperature?.value || 20);
            this.infoElements.temp.textContent = tVal >= 42 ? `${tVal}°C (máx)` : `${tVal}°C`;
        }
        if (this.infoElements.movement) {
            this.infoElements.movement.textContent = `${this.controls_ui.movement?.value || 50}%`;
        }
        if (this.infoElements.emotion) {
            const emotionMap = {
                'impulsiva': 'Impulsiva',
                'reflexiva': 'Reflexiva',
                'contenida': 'Contenida',
                'expansiva': 'Expansiva'
            };
            this.infoElements.emotion.textContent = emotionMap[this.controls_ui.emotion?.value] || 'Reflexiva';
        }
        if (this.infoElements.heartrate) {
            this.infoElements.heartrate.textContent = `${this.controls_ui.heartrate?.value || 80} bpm`;
        }
        
        // Actualizar estado de animación
        const currentTime = Date.now();
        this.frameCount++;
        
        // Calcular FPS cada segundo
        if (currentTime - this.lastTime >= 1000) {
            const fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime));
            if (this.infoElements.fps) {
                this.infoElements.fps.textContent = fps.toString();
            }
            this.frameCount = 0;
            this.lastTime = currentTime;
        }
        
        if (this.infoElements.particles) {
            if (this.auraSystem && typeof this.auraSystem.getParticleCount === 'function') {
                this.infoElements.particles.textContent = this.auraSystem.getParticleCount().toString();
            } else {
                this.infoElements.particles.textContent = '2000';
            }
        }
        
        if (this.auraSystem && this.infoElements.time) {
            this.infoElements.time.textContent = `${this.auraSystem.time.toFixed(1)}s`;
        }
        
        // Velocidad orbital basada en movimiento
        if (this.infoElements.orbitalSpeed) {
            const movement = parseFloat(this.controls_ui.movement?.value || 50);
            const speed = (movement / 50).toFixed(1);
            this.infoElements.orbitalSpeed.textContent = `${speed}x`;
        }
    }
    
    saveCurrentAura() {
        const params = {
            temperature: this.controls_ui.temperature?.value,
            weight: this.controls_ui.weight?.value,
            movement: this.controls_ui.movement?.value,
            height: this.controls_ui.height?.value,
            heartrate: this.controls_ui.heartrate?.value,
            sound: this.controls_ui.sound?.value,
            proximity: this.controls_ui.proximity?.value,
            posture: this.controls_ui.posture?.value,
            emotion: this.controls_ui.emotion?.value,
            timestamp: new Date().toISOString()
        };
        
        // Guardar en localStorage
        const savedAuras = JSON.parse(localStorage.getItem('savedAuras') || '[]');
        savedAuras.push(params);
        localStorage.setItem('savedAuras', JSON.stringify(savedAuras));
        
        // También descargar como JSON
        const blob = new Blob([JSON.stringify(params, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aura-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('💾 Aura guardada correctamente', params);
    }
    
    toggleAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
            console.log('⏸️ Animación pausada');
        } else {
            this.animate();
            console.log('▶️ Animación reanudada');
        }
    }
    
    onWindowResize() {
        const container = document.getElementById('canvas-container');
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        
        AuraUtils.debugLog('Ventana redimensionada', { width, height });
    }
    
    setCameraOrientationDeg(azimuthDeg, polarDeg, radius) {
        // azimuth: 0° mira hacia -Z si colocamos cámara sobre eje Z positivo (ajustamos a convención Three)
        const az = THREE.Math.degToRad(azimuthDeg);
        const pol = THREE.Math.degToRad(polarDeg);
        const r = radius || this.initialCameraRadius || 0.14;
        const target = this.controls ? this.controls.target : new THREE.Vector3(0,0,0);
        const sinPol = Math.sin(pol);
        const x = r * sinPol * Math.sin(az);
        const y = r * Math.cos(pol);
        const z = r * sinPol * Math.cos(az);
        this.camera.position.set(target.x + x, target.y + y, target.z + z);
        this.camera.lookAt(target);
        if (this.controls) this.controls.update();
    }
    
    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        const deltaTime = 0.016; // ~60fps
        
        // Actualizar controles
        this.controls.update();
        
    // Asegurar que el target siga en el centro (por seguridad si algún ajuste externo lo cambiara)
    if (!this.controls.target.equals(this.originalTarget)) this.controls.target.copy(this.originalTarget);

    // Esfera ambiental fija en el origen (opción A): no se actualiza posición.
        
        // Actualizar sistema de aura
        if (this.auraSystem) {
            this.auraSystem.animate(deltaTime);
        }
        
        // Actualizar panel de información
        this.updateInfoPanel();
        
        // Renderizar escena
        this.renderer.render(this.scene, this.camera);
    }
    
    showError(message) {
        this.loadingElement.innerHTML = `
            <div style="color: #ff4444;">
                ❌ ${message}
                <br><small>Revisa la consola para más detalles</small>
            </div>
        `;
    }
    
    dispose() {
        // Limpiar recursos
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        if (this.auraSystem) {
            this.auraSystem.dispose();
        }
        
        if (this.renderer) {
            this.renderer.dispose();
        }
    }
}

// Inicializar aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.auraApp = new AuraVisualization();
});

// Limpiar al cerrar la página
window.addEventListener('beforeunload', () => {
    if (window.auraApp) {
        window.auraApp.dispose();
    }
});
