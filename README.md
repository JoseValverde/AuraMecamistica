# Proyecto: Visualización de Aura Sensorial

## Fase de Ideación

### Objetivo

Desarrollar una experiencia visual inmersiva que represente el "aura" de una persona a partir de datos sensoriales (peso, temperatura, movimiento, etc.). Esta visualización servirá como pieza interactiva en una instalación artística y como prototipo de una posible aplicación web o móvil.

---

## Tecnologías principales

- **Three.js**: Motor de gráficos 3D en WebGL para la visualización del aura.
- **JavaScript / HTML / CSS**: Interfaz básica para recoger datos manuales e integrarlos con la visualización.
- **TouchDesigner** (en fases futuras): Para traducción física/sensorial en instalación real.
- **Arduino** (futuro): Recolección de datos físicos a partir de sensores.

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
├── index.html          # Página principal
├── css/
│   └── styles.css      # Estilos para la interfaz
├── js/
│   ├── main.js         # Lógica principal y controles
│   ├── aura-system.js  # Sistema de partículas del aura
│   └── utils.js        # Funciones auxiliares
└── assets/             # Recursos (si necesarios)
```

### Funcionalidades principales:

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
   - Responsive (se adapta al tamaño de ventana)
   - 60 FPS suave
   - Transiciones graduales entre estados
   - Posibilidad de guardar configuraciones

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

- Se busca que la experiencia sea **personal, evocadora y estética**, sin caer en una lectura pseudocientífica o tecnológica fría.
- Las auras generadas podrán guardarse y reproducirse posteriormente.
- El proyecto puede crecer hacia una app que capture estos datos en tiempo real y genere visualizaciones interactivas personales.