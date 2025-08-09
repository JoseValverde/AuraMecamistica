// Funciones auxiliares para el proyecto

// Mapear valores entre rangos
function mapRange(value, inMin, inMax, outMin, outMax) {
    return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}

// Interpolar colores HSL
function interpolateHSL(color1, color2, factor) {
    if (factor <= 0) return color1;
    if (factor >= 1) return color2;
    
    const h1 = color1.h, s1 = color1.s, l1 = color1.l;
    const h2 = color2.h, s2 = color2.s, l2 = color2.l;
    
    // Interpolar el matiz considerando el círculo cromático
    let h;
    const diff = h2 - h1;
    if (Math.abs(diff) <= 180) {
        h = h1 + diff * factor;
    } else if (diff > 180) {
        h = h1 + (diff - 360) * factor;
    } else {
        h = h1 + (diff + 360) * factor;
    }
    
    // Normalizar matiz
    h = ((h % 360) + 360) % 360;
    
    return {
        h: h,
        s: s1 + (s2 - s1) * factor,
        l: l1 + (l2 - l1) * factor
    };
}

// Convertir HSL a THREE.Color
function hslToThreeColor(hsl) {
    const color = new THREE.Color();
    color.setHSL(hsl.h / 360, hsl.s / 100, hsl.l / 100);
    return color;
}

// Stops HSL para mapa de temperatura (Opción A extendida con rojo intenso final)
// t en °C, h en [0-360), s,l en %
const TEMP_COLOR_STOPS = [
    { t: 0,  h: 250, s: 85, l: 40 }, // azul violáceo frío extremo
    { t: 10, h: 220, s: 80, l: 45 }, // azul medio
    { t: 20, h: 190, s: 70, l: 50 }, // cian
    { t: 28, h: 150, s: 65, l: 48 }, // verde-turquesa transición
    { t: 34, h: 55,  s: 90, l: 55 }, // amarillo cálido
    { t: 37, h: 30,  s: 95, l: 55 }, // naranja
    { t: 40, h: 10,  s: 88, l: 50 }, // rojo anaranjado
    { t: 42, h: 0,   s: 90, l: 45 }  // rojo intenso final
];

// Generar color basado en temperatura con múltiples stops
function getTemperatureColor(temp) {
    // Clamp de temperatura al rango soportado
    const clamped = Math.max(TEMP_COLOR_STOPS[0].t, Math.min(temp, TEMP_COLOR_STOPS[TEMP_COLOR_STOPS.length - 1].t));
    // Buscar intervalo
    for (let i = 0; i < TEMP_COLOR_STOPS.length - 1; i++) {
        const a = TEMP_COLOR_STOPS[i];
        const b = TEMP_COLOR_STOPS[i + 1];
        if (clamped <= b.t) {
            const span = b.t - a.t;
            const f = span === 0 ? 0 : (clamped - a.t) / span;
            return interpolateHSL(a, b, f);
        }
    }
    return TEMP_COLOR_STOPS[TEMP_COLOR_STOPS.length - 1];
}

// Generar variaciones de color para partículas
function generateColorVariations(baseColor, count = 5) {
    const colors = [];
    for (let i = 0; i < count; i++) {
        // Reducir dispersión de matiz para mantener lectura del gradiente térmico
        const variation = {
            h: (baseColor.h + (Math.random() - 0.5) * 25 + 360) % 360,
            s: Math.max(25, Math.min(100, baseColor.s + (Math.random() - 0.5) * 20)),
            l: Math.max(25, Math.min(75, baseColor.l + (Math.random() - 0.5) * 25))
        };
        colors.push(hslToThreeColor(variation));
    }
    return colors;
}

// Función de suavizado (easing)
function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Calcular posición en espiral
function spiralPosition(angle, radius, height, tightness = 1) {
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = height * (angle / (Math.PI * 2 * tightness));
    return new THREE.Vector3(x, y, z);
}

// Calcular posición en elipse
function ellipsePosition(angle, radiusX, radiusY, radiusZ) {
    const x = Math.cos(angle) * radiusX;
    const y = Math.sin(angle * 0.7) * radiusY;
    const z = Math.sin(angle) * radiusZ;
    return new THREE.Vector3(x, y, z);
}

// Añadir ruido a posiciones
function addNoise(position, amount = 0.1) {
    position.x += (Math.random() - 0.5) * amount;
    position.y += (Math.random() - 0.5) * amount;
    position.z += (Math.random() - 0.5) * amount;
    return position;
}

// Función para crear animación suave entre estados
function createTween(from, to, duration, callback, easing = easeInOutCubic) {
    const start = Date.now();
    
    function animate() {
        const elapsed = Date.now() - start;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easing(progress);
        
        const current = from + (to - from) * easedProgress;
        callback(current);
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }
    
    animate();
}

// Debug: logs con estilo
function debugLog(message, data = null) {
    if (window.DEBUG_MODE) {
        console.log(`%c🌟 AURA DEBUG: %c${message}`, 
            'color: #81069b; font-weight: bold;',
            'color: #ffffff;',
            data || ''
        );
    }
}

// Activar modo debug (descomenta la siguiente línea para debug)
// window.DEBUG_MODE = true;

// Exportar funciones para uso global
window.AuraUtils = {
    mapRange,
    interpolateHSL,
    hslToThreeColor,
    getTemperatureColor,
    generateColorVariations,
    easeInOutCubic,
    spiralPosition,
    ellipsePosition,
    addNoise,
    createTween,
    debugLog
};
