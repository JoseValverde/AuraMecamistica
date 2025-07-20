// Aplicación principal
class AuraVisualization {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.auraSystem = null;
        this.animationId = null;
        
        // Elementos del DOM
        this.canvas = document.getElementById('aura-canvas');
        this.loadingElement = document.getElementById('loading');
        
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
        this.camera.position.set(0, 0, 5);
        
        // Configurar renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true
        });
        
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        
        // Configurar controles de órbita
        this.controls = new THREE.OrbitControls(this.camera, this.canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enableZoom = true;
        this.controls.enablePan = false;
        this.controls.maxDistance = 10;
        this.controls.minDistance = 2;
        
        // Añadir iluminación ambiental sutil
        const ambientLight = new THREE.AmbientLight(0x404040, 0.1);
        this.scene.add(ambientLight);
        
        AuraUtils.debugLog('Three.js inicializado', {
            resolution: `${container.clientWidth}x${container.clientHeight}`,
            pixelRatio: this.renderer.getPixelRatio()
        });
    }
    
    initAuraSystem() {
        this.auraSystem = new AuraSystem();
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
        
        // Botones
        const resetBtn = document.getElementById('reset-btn');
        const saveBtn = document.getElementById('save-btn');
        
        resetBtn?.addEventListener('click', () => this.resetToDefaults());
        saveBtn?.addEventListener('click', () => this.saveCurrentAura());
        
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
            this.valueDisplays.temperature.textContent = `${temp}°C`;
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
        
        // Resetear cámara
        this.camera.position.set(0, 0, 5);
        this.controls.reset();
        
        console.log('🔄 Parámetros restaurados a valores por defecto');
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
    
    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        const deltaTime = 0.016; // ~60fps
        
        // Actualizar controles
        this.controls.update();
        
        // Actualizar sistema de aura
        if (this.auraSystem) {
            this.auraSystem.animate(deltaTime);
        }
        
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
