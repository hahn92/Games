# Games Plugin for Claude Code

Plugin para el proyecto de juegos de navegador. Provee skills, agentes y hooks automáticos para crear, validar y mantener los 70 juegos clásicos.

## Instalación

```bash
# Cargar el plugin en una sesión
claude --plugin-dir ./games-plugin

# Recargar después de cambios
/reload-plugins
```

## Skills disponibles

Todos los skills usan el prefijo `/games:`.

| Skill | Descripción |
|-------|-------------|
| `/games:new-game [nombre]` | Crea un nuevo juego completo desde cero (archivos, catalog entry, CLAUDE.md) |
| `/games:validate-game [nombre]` | Valida todos los criterios de calidad de un juego (o todos si se omite el nombre) |
| `/games:add-sounds [nombre]` | Integra `GameAudio.*` en un juego específico |
| `/games:audit-sounds` | Revisa cobertura de sonido en los 70 juegos y lista qué falta |
| `/games:check-mobile [nombre]` | Audita layout móvil, canvas scaling y touch handling |
| `/games:fix-performance [nombre]` | Detecta y corrige anti-patrones de rendimiento en canvas |

## Agentes disponibles

| Agente | Cuándo usarlo |
|--------|---------------|
| `game-validator` | Después de implementar o modificar un juego |
| `sound-auditor` | Para revisar cobertura de sonido en todos los juegos |
| `mobile-auditor` | Para verificar la experiencia móvil después de cambios |

## Hooks automáticos

El plugin ejecuta checks automáticamente al editar `main.js` o `index.html`:

**Al editar `main.js`:**
- ⚠ `ctx.shadowBlur` dentro de loops
- ⚠ Emoji en `ctx.fillText()`
- ⚠ `setInterval` como game loop (sin `requestAnimationFrame`)
- ⚠ `Math.random()` dentro de funciones de render
- ℹ `GameAudio` no integrado

**Al editar `index.html`:**
- ⚠ `'100vw'` detectado (debe ser `window.innerWidth + 'px'`)
- ⚠ `audio.js` incluido pero falta `fullscreen-btn.js` (o viceversa)

## Flujo para agregar un nuevo juego

```
1. /games:new-game myjuego          # scaffold completo
2. # implementa la lógica en main.js
3. /games:add-sounds myjuego        # agrega sonidos
4. /games:check-mobile myjuego      # verifica móvil
5. /games:validate-game myjuego     # checklist final
```

## Archivos compartidos del proyecto

| Archivo | Propósito |
|---------|-----------|
| `audio.js` | Sistema de sonido Web Audio API — `GameAudio.*()` |
| `fullscreen-btn.js` | Botón flotante de pantalla completa / orientación horizontal |
| `styles.css` | Variables CSS compartidas y reglas globales |
