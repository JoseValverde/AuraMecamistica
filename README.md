# Aura Mecaminística – Visualización Bio‑Emocional GPU

Experiencia visual interactiva que representa un "aura" dinámica construida con miles de partículas 3D que reaccionan a parámetros fisiológicos simbólicos (temperatura, peso, movimiento, ritmo cardíaco), estados emocionales, postura y proximidad. La simulación principal corre en la GPU mediante shaders personalizados (GPGPU) para lograr fluidez con un único draw call.

---

## Estado Actual (Agosto 2025)

- Motor de partículas dual: CPU (referencia) y GPU (activo por defecto).
- Cómputo en GPU: integración de velocidad/posición con texturas flotantes (ping‑pong) y fragment shaders.
- Perfiles emocionales con transición suave (interpolación temporal y fase acumulativa) que afectan: orbitMultiplier, ruido, amplitud y velocidad de ondas tangenciales, jitter radial, grosor de la “capa” y pulsación visual.
- Postura y proximidad modifican la morfología (escalado anisotrópico aplicado tras reproyección parcial para evitar concentraciones en polos).
- Warmup inicial: jitter tangencial decreciente + pre‐cómputo para dispersión homogénea (mitiga “tapas” polares).
- Distribución inicial pseudo-uniforme (Fibonacci) con variación radial (0.65R–1.0R).
- Reproyección parcial (mezcla adaptativa) preserva suavidad sin colapsar en polos.
- Debug modes: color por coordenada de textura y color por normalizada de posición.
- Mezcla aditiva controlada con corrección de luminancia para evitar saturación blanca.
- Config flags globales en `js/config.js`.

---

## Objetivo Original

Representar una “aura” estética, orgánica y evocadora que sirva como pieza artística y base para futura integración con sensores físicos (Arduino / TouchDesigner) o una app web.

---

## Tecnologías principales

- Three.js (renderizado 3D y Points GPU).
- GLSL (vertex + fragment shaders para render y cómputo).
- GPGPU mediante render targets flotantes (RGBA32F) y técnica ping‑pong minimalista.
- JavaScript (gestión de estados, transición emocional, UI básica).
- Futuro: TouchDesigner / Arduino para datos reales.

### Técnicas Shader Clave

- Integración de velocidad en fragment shader (rotación orbital + pseudo ruido hash + corrección radial de retorno a la cáscara).
- Jitter tangencial controlado por emoción y fase.
- Ondas tangenciales (dos bases ortogonales) moduladas por seed por partícula + fase emocional acumulativa.
- Jitter radial y grosor (shellThickness) para “respiración” del aura.
- Mezcla de reproyección: `pos = mix(pos, shellPos, factor)` con factor dependiente de warmup para evitar alineación temprana en polos.
- Pulsación en vertex shader (sin recostear CPU) según seed y emoción.

---

## Datos de entrada

### Lectura mediante sensores Arduino (futuro)

- **Peso (estimado o real con celda de carga)**
- **Temperatura (sensor ambiental o corporal)**
- **Nivel de movimiento (acelerómetro o giroscopio)**
- **Altura (estimada mediante sensor de distancia, opcional)**
- **Frecuencia cardíaca (medible con pulsómetro tipo MAX30100)**
- **Nivel de sonido ambiental (micrófono analógico o digital)**
- **Presencia o proximidad (sensor ultrasónico o infrarrojo)**
- **Color predominante en entorno (con sensor de color TCS34725)**

### Input simbólico / subjetivo del usuario

- **Postura corporal** (selección entre opciones: erguido / encorvado / en reposo / en tensión)
- **Proximidad a otros cuerpos** (percibida: aislado / próximo / rodeado)
- **Intención emocional** (impulsiva / reflexiva / contenida / expansiva)

---

## Visualización

- **Fondo oscuro y mínima luz**: resalta partículas, colores y formas.
- **Representación del aura**:
  - Capa de partículas orgánicas
  - Espirales o halos
  - Color, intensidad y forma afectadas por los datos
- **Estado emocional** (fase futura): posibilidad de introducir emociones y que afecten la visualización.

### Sobre la visualización del aura:

#### ¿Qué forma base prefieres para el aura?

En la pantalla se crea formas compuestas de sistemas de particulas en funcion de la entrada de variable de datos que puede organizarce en espiral más o menos cerrada, en una forma elipsoide, circular, amorfar, como podemos encontrar en nebulosas espaciales.

Sería valida cualquiera de estas formas: Campo de partículas sin forma específica, Capas concéntricas, o Ondas o emanaciones desde un punto central?

#### ¿Cómo imaginas que cada dato afecte la visualización?

Temperatura → colores más cálidos/fríos
Peso → densidad de particulas
Movimiento → velocidad de animación/turbulencia
Altura → tamaño del aura
Frecuencia cardíaca → pulsaciones/ritmo
  
#### ¿Qué paleta de colores te atrae más?

Espectro completo (arcoíris) con Gradientes saturados, las particulas tienen variación entre ellos

### Sobre la interacción:

¿Prefieres controles tipo sliders, botones, o campos numéricos para los datos manuales? slider

¿Quieres que la visualización sea:

Totalmente automática una vez introducidos los datos y Interactiva (poder rotar, hacer zoom, cambiar vista)

### Sobre la experiencia:

¿Tienes alguna referencia visual que te inspire? (puede ser arte, otras visualizaciones, etc.)

https://drive.google.com/file/d/1H0eiNE5CJnMcSg_JH37_4DryaEYjhfWX/view?usp=sharing 

¿La pantalla será fullscreen o dentro de una interfaz más amplia? trabjamos con el tamaño de la ventana del navegador

## Arquitectura de la visualización

### Estructura de archivos:
```
/app
├── index.html              # Página principal / punto de entrada
├── css/
│   └── styles.css          # Estilos UI
├── js/
│   ├── config.js           # Flags globales (AURA_SPHERE_RADIUS, AURA_USE_GPU)
│   ├── main.js             # Inicialización, UI y bucle de animación
│   ├── utils.js            # Funciones auxiliares (mapRange, colores, etc.)
│   ├── aura-system.js      # Implementación CPU (referencia / fallback)
│   ├── gpu-compute-min.js  # Mini helper de cómputo GPGPU (ping‑pong)
│   └── gpu-aura-system.js  # Implementación GPU (simulación + render)
└── assets/                 # Texturas / recursos (si se añaden)
```

### Flujo GPU (resumen)
1. Inicialización: creación de texturas posición/velocidad (Float) con distribución Fibonacci + perturbaciones.
2. Prewarm: varias iteraciones de compute invisibles + jitter warmup.
3. Cada frame:
   - Shader velocidad: integra rotación orbital, ruido hash, respiración y corrección radial.
   - Shader posición: aplica desplazamientos tangenciales y reproyección parcial adaptativa; postureScale al final.
   - Obtención de textura de posiciones -> vertex shader (Points).
   - Vertex shader: samplea posición, aplica pulsación, tamaño dependiente de distancia.
   - Fragment shader: aplica textura de punto y mezcla aditiva cuidada.
4. Transición emocional: interpolación de perfiles y avance de fase para continuidad.

### Flags / Config
- `window.AURA_SPHERE_RADIUS` (default 8) – radio base de la esfera.
- `window.AURA_USE_GPU = true|false` – alterna implementación.

Para forzar CPU: establecer `AURA_USE_GPU = false` antes de cargar `main.js`.

### Funcionalidades principales

1. **Sistema de partículas nebulosas** con Three.js que puede transformarse entre:
   - Espirales cerradas/abiertas
   - Formas elipsoidales
   - Campos amorfos tipo nebulosa
   - Ondas concéntricas

2. **Panel de control lateral** con sliders para:
   - Temperatura (0-40°C) → colores cálidos/fríos
   - Peso (40-120kg) → densidad de partículas
   - Movimiento (0-100%) → velocidad/turbulencia
   - Altura (150-200cm) → tamaño del aura
   - Frecuencia cardíaca (60-120 bpm) → pulsaciones
   - Nivel sonido (0-100%) → amplitud de ondas
   - Proximidad (aislado/próximo/rodeado) → forma del aura
   - Estados emocionales → morfología

3. **Visualización 3D interactiva**:
   - Cámara orbital (rotar, zoom)
   - Fondo negro profundo
   - Espectro completo de colores con gradientes saturados
   - Animaciones fluidas y orgánicas

4. **Características técnicas**:
   - Un único draw call (Points) en modo GPU.
   - Texturas flotantes para cómputo sin ida y vuelta CPU.
   - Warmup y pre-cómputo para estabilidad inicial.
   - Transiciones emocionales easing (cosine in-out) + fase continua.
   - Debug visual conmutables (UV / posición normalizada).
   - Preparado para integración de sensores físicos.

---

## Etapas del proyecto

1. **Ideación y documentación** (→ este documento)
2. **Desarrollo de visualización base con datos manuales**
3. **Interfaz simple para introducir datos**
4. **Ajuste visual: colores, formas y comportamiento**
5. **Integración con sensores reales (Arduino + TouchDesigner)**
6. **Fase de instalación + proyección**
7. **(Opcional) Versión web accesible con QR personalizado para cada aura**

---

## Notas adicionales

- Enfoque en estética orgánica y evocadora (no pretende validar interpretaciones esotéricas).
- Persistencia futura: posibilidad de snapshot de parámetros + semilla para reproducir auras.
- Extensible a multi‑usuario (fusionar volúmenes o interpolar entre perfiles).
- Potenciales mejoras:
   - Añadir ruido 3D real (Perlin/Simplex) con textura para campos más ricos.
   - Dithering / tonemapping personalizado para HDR bloom moderado.
   - Exportación de frames / secuencias.
   - Sistema de eventos para transiciones guiadas (coreografías).

---

## Ejecución Rápida

Abrir `index.html` en un navegador moderno (Chrome / Firefox). Si el navegador bloquea texturas flotantes en local file, servir con un pequeño servidor estático.

Opcional (ejemplo con npx):
```
npx http-server .
```
Luego navegar a `http://localhost:8080/app/`.

---

## Créditos / Autoría

Concepto y dirección creativa: jagvalverde.com
Desarrollo visual / shaders: jagvalverde.com

---

## English Translation (Project Stages onward)

### Project Stages
1. Ideation & documentation (→ this document)
2. Base visualization with manual data
3. Simple interface for data input
4. Visual tuning: colors, shapes and behavior
5. Integration with real sensors (Arduino + TouchDesigner)
6. Installation phase + projection
7. (Optional) Web version accessible via personalized QR for each aura

### Additional Notes
- Focus on organic, evocative aesthetics (does not attempt to validate esoteric interpretations).
- Future persistence: snapshot of parameters + seed to reproduce auras.
- Extensible to multi‑user scenarios (merge volumes or interpolate between profiles).
- Potential enhancements:
   - Add real 3D noise (Perlin/Simplex) via texture for richer motion fields.
   - Custom dithering / tonemapping for moderate HDR bloom.
   - Frame / sequence export.
   - Event system for guided transitions (choreographies).

### Quick Run
Open `index.html` in a modern browser (Chrome / Firefox). If the browser blocks floating-point textures via file://, serve with a small static server.

Optional (example with npx):
```
npx http-server .
```
Then navigate to `http://localhost:8080/app/`.

### Credits
Creative concept & direction: jagvalverde.com
Visual / shader development: jagvalverde.com

---
