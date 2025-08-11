// Implementación mínima de GPUComputationRenderer (MIT-like) para fallback local
(function(){
  if (!window.THREE) return;
  if (window.GPUComputationRenderer) return; // si ya existe (CDN) no sobrescribir
  class GPUComputationRenderer {
    constructor(width, height, renderer) {
      this.width = width; this.height = height; this.renderer = renderer;
      this.variables = [];
      this.currentTextureIndex = 0;
      this.scene = new THREE.Scene();
      this.camera = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
      const geom = new THREE.PlaneBufferGeometry(2,2);
      this.passMesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial());
      this.scene.add(this.passMesh);
    }
    createTexture() {
      const data = new Float32Array(this.width * this.height * 4);
  const tex = new THREE.DataTexture(data, this.width, this.height, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.needsUpdate = true;
      return tex;
    }
    addVariable(name, fragmentShader, initialValueTexture) {
      // Uniforms base; se ampliarán dinámicamente según código del shader
      const baseUniforms = {
        resolution: { value: new THREE.Vector2(this.width, this.height) },
        texturePosition: { value: null },
        textureVelocity: { value: null },
        delta: { value: 0.016 },
        time: { value: 0 },
        radius: { value: 1 },
        orbitStrength: { value: 0 },
        damping: { value: 0.99 },
        noiseMultiplier: { value: 1 },
        tangentialWaveAmp: { value: 0 },
        waveSpeed: { value: 0 },
        radialJitter: { value: 0 },
        shellThickness: { value: 0 },
        emotionPhase: { value: 0 },
        pulsate: { value: 0 }
      };
  const material = new THREE.ShaderMaterial({
        uniforms: baseUniforms,
        vertexShader: 'void main(){ gl_Position = vec4(position,1.0); }',
        fragmentShader
      });
      const rtOptions = { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, stencilBuffer: false };
      const rtA = new THREE.WebGLRenderTarget(this.width, this.height, rtOptions);
      const rtB = new THREE.WebGLRenderTarget(this.width, this.height, rtOptions);
      this._initRenderTarget(rtA, initialValueTexture);
      this._initRenderTarget(rtB, initialValueTexture);
      const variable = { name, material, dependencies: [], renderTargets: [rtA, rtB] };
      this.variables.push(variable);
      return variable;
    }
    setVariableDependencies(variable, deps) { variable.dependencies = deps; }
    _initRenderTarget(target, srcTex) {
      const copyMat = new THREE.ShaderMaterial({
        uniforms: { srcTex: { value: srcTex }, resolution: { value: new THREE.Vector2(this.width, this.height) } },
        vertexShader: 'void main(){ gl_Position = vec4(position,1.0); }',
        // Usar coordenadas centradas: gl_FragCoord.xy / resolution ya apunta al centro del texel inicial (0.5/res)
        fragmentShader: 'uniform sampler2D srcTex; uniform vec2 resolution; void main(){ vec2 uv = gl_FragCoord.xy / resolution; gl_FragColor = texture2D(srcTex, uv); }'
      });
      const prev = this.passMesh.material; this.passMesh.material = copyMat;
      this.renderer.setRenderTarget(target); this.renderer.render(this.scene, this.camera);
      this.passMesh.material = prev; copyMat.dispose();
      this.renderer.setRenderTarget(null);
    }
    init() { return null; }
    compute() {
      const next = 1 - this.currentTextureIndex;
      for (const variable of this.variables) {
        if (!variable || !variable.material) continue;
  const uniforms = variable.material.uniforms || {};
  if (!uniforms.texturePosition) uniforms.texturePosition = { value: null };
  if (!uniforms.textureVelocity) uniforms.textureVelocity = { value: null };
        // Aplicar dependencias (variable.name es el identificador suministrado al addVariable)
        if (Array.isArray(variable.dependencies)) {
          for (const dep of variable.dependencies) {
            if (!dep) continue;
            if (uniforms.texturePosition && dep.name === 'texturePosition') {
              uniforms.texturePosition.value = dep.renderTargets[this.currentTextureIndex].texture;
            }
            if (uniforms.textureVelocity && dep.name === 'textureVelocity') {
              uniforms.textureVelocity.value = dep.renderTargets[this.currentTextureIndex].texture;
            }
          }
        }
        this.passMesh.material = variable.material;
        const targetRT = variable.renderTargets ? variable.renderTargets[next] : null;
        if (!targetRT) continue;
        this.renderer.setRenderTarget(targetRT);
        this.renderer.render(this.scene, this.camera);
      }
      this.renderer.setRenderTarget(null);
      this.currentTextureIndex = next;
    }
    getCurrentRenderTarget(variable) { return variable.renderTargets[this.currentTextureIndex]; }
  }
  window.GPUComputationRenderer = GPUComputationRenderer;
  console.log('[gpu-compute-min] GPUComputationRenderer local cargado');
})();
