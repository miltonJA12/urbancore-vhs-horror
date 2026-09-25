# URBANCORE // VHS Horror

Videojuego web 3D de terror desarrollado con **Three.js**, **Rapier 3D** y JavaScript.

El jugador explora una ciudad oscura con estética VHS mientras busca cintas, restaura la energía y evita una entidad hostil que aparece durante la partida.

---

## Descripción del videojuego

**URBANCORE // VHS Horror** es un videojuego de terror en tercera persona ambientado en una ciudad oscura y abandonada.

El jugador debe recorrer el escenario, localizar objetos importantes, completar una secuencia de objetivos y sobrevivir a una entidad que comienza a aparecer conforme avanza la misión.

El juego combina:

- Exploración en tercera persona.
- Física 3D.
- Colisiones.
- Objetos dinámicos.
- Proyectiles.
- Sistema de stamina.
- Sistema de vidas.
- Interacción con objetos.
- Misiones progresivas.
- Efectos visuales estilo VHS.
- Enemigo con sistema de acecho y persecución.

---

## Historia y objetivo de la misión

El jugador despierta dentro de una ciudad aparentemente abandonada.

La única pista disponible es una serie de grabaciones VHS distribuidas por diferentes puntos del escenario.

El objetivo inicial es encontrar la primera cinta.

Después de recuperarla, comienzan a ocurrir sucesos extraños y una entidad aparece en diferentes partes de la ciudad.

Para continuar, el jugador debe encontrar una llave de mantenimiento, localizar un fusible y restaurar la energía.

Cuando la electricidad vuelve a funcionar, la entidad comienza a perseguir al jugador de forma permanente.

La misión final consiste en recuperar las cinco cintas y llevarlas hasta una torre de transmisión.

Al activar el transmisor se completa la misión.

---

## Objetivos de la misión

La progresión principal del videojuego es:

1. Encontrar la primera cinta VHS.
2. Encontrar la llave de mantenimiento.
3. Encontrar un fusible.
4. Restaurar la energía de la ciudad.
5. Recuperar las cintas restantes.
6. Evitar a la entidad.
7. Encontrar la torre de transmisión.
8. Transmitir las grabaciones.
9. Completar la misión.

---

## Reglas del juego

El jugador cuenta con un número limitado de vidas.

Durante la partida debe explorar el escenario y completar los objetivos indicados en pantalla.

La entidad aparece después de recoger la primera cinta.

Antes de restaurar la energía, la entidad puede aparecer temporalmente a distancia.

Después de restaurar la electricidad comienza una persecución permanente.

Si la entidad alcanza al jugador:

- Se activa un screamer.
- El jugador pierde una vida.
- El jugador reaparece en el punto inicial.

Si el jugador pierde todas sus vidas, la partida termina.

---

## Condición de victoria

Para ganar la partida se deben cumplir los siguientes objetivos:

- Restaurar la energía.
- Recuperar las cinco cintas VHS.
- Encontrar el transmisor.
- Activar la transmisión.

Cuando se completa la transmisión aparece la pantalla de victoria.

---

## Condición de derrota

La partida termina cuando el jugador pierde todas sus vidas.

Las vidas pueden perderse principalmente cuando:

- La entidad alcanza al jugador.
- El jugador cae fuera de los límites válidos del escenario.

Al perder todas las vidas aparece la pantalla de derrota.

El jugador puede reiniciar la partida.

---

## Controles de teclado y mouse

### Teclado

| Tecla       | Acción                             |
| ----------- | ----------------------------------- |
| `W`       | Avanzar                             |
| `A`       | Moverse a la izquierda              |
| `S`       | Retroceder                          |
| `D`       | Moverse a la derecha                |
| `Shift`   | Correr                              |
| `Espacio` | Saltar                              |
| `E`       | Interactuar                         |
| `F`       | Encender / apagar linterna          |
| `F3`      | Mostrar información de depuración |
| `Esc`     | Pausar / liberar el cursor          |

### Mouse

| Acción              | Función             |
| -------------------- | -------------------- |
| Movimiento del mouse | Controlar la cámara |
| Click izquierdo      | Lanzar proyectil     |

La cámara utiliza un sistema de tercera persona con seguimiento del personaje.

---

## Tecnologías utilizadas

El proyecto fue desarrollado utilizando:

- HTML5
- CSS3
- JavaScript ES Modules
- Three.js
- Rapier 3D
- GLTFLoader
- FBXLoader
- AnimationMixer
- Octree
- Capsule Collider
- EffectComposer
- ShaderPass
- PointerLockControls
- Web Audio API
- Git
- GitHub
- GitHub Pages
- Visual Studio Code

---

## Uso de Three.js

Three.js se utiliza para:

- Crear y renderizar la escena 3D.
- Gestionar la cámara.
- Cargar modelos GLB y FBX.
- Renderizar iluminación.
- Crear materiales.
- Crear efectos visuales.
- Controlar animaciones.
- Mostrar los objetos del escenario.

---

## Sistema de física

El videojuego utiliza dos sistemas relacionados con física y colisiones.

### Colisiones del jugador

El jugador utiliza:

- `Octree`
- `Capsule`

El escenario se analiza y se genera una estructura de colisión.

El personaje utiliza una cápsula que permite detectar colisiones con paredes y superficies.

Esto evita que el jugador atraviese los elementos principales del escenario.

También se utiliza gravedad para mantener al jugador sobre el suelo.

---

### Rapier 3D

Rapier 3D se utiliza para generar objetos físicos dinámicos.

Los objetos pueden:

- Caer por gravedad.
- Colisionar.
- Recibir impulsos.
- Rotar.
- Ser desplazados por proyectiles.

Se utilizan cuerpos rígidos y colliders.

El sistema incluye varios tipos de objetos físicos:

- Cajas.
- Esferas.
- Cilindros.
- Conos.

---

## Estructura derribable

Durante la ejecución del juego se genera una estructura compuesta por varios bloques físicos.

Estos bloques utilizan cuerpos rígidos de Rapier.

El jugador puede disparar proyectiles contra la estructura para derribarla.

Esto demuestra:

- Colisiones dinámicas.
- Gravedad.
- Aplicación de impulsos.
- Rotación física.
- Interacción entre objetos.

---

## Mecánica principal de proyectiles

El jugador puede lanzar proyectiles utilizando el click izquierdo del mouse.

Los proyectiles utilizan cuerpos rígidos creados con Rapier 3D.

Cuando un proyectil impacta contra un objeto dinámico:

- Se aplica una fuerza.
- El objeto cambia de posición.
- Puede cambiar su rotación.
- Puede provocar la caída de otros objetos.

---

## Parámetro configurable: Shot Power

El videojuego incluye un control denominado:

`SHOT POWER`

Este parámetro modifica la fuerza del proyectil.

El jugador puede cambiar la potencia utilizando un control deslizante dentro del HUD.

Una potencia mayor genera un impacto más fuerte sobre los objetos físicos.

---

## Objetos generados dinámicamente

Durante la ejecución del videojuego se generan distintos objetos físicos en posiciones válidas del escenario.

Entre ellos se encuentran:

- Cajas.
- Esferas.
- Cilindros.
- Conos.

Las posiciones se obtienen utilizando puntos válidos detectados sobre el suelo del escenario.

---

## Sistema de stamina

El jugador dispone de una barra de stamina.

Cuando corre:

- La stamina disminuye.

Cuando deja de correr:

- La stamina se recupera.

Cuando se agota:

- El personaje deja temporalmente de correr.

Esto evita que el jugador pueda utilizar sprint permanentemente.

---

## Sistema de vidas

El jugador cuenta con varias vidas representadas dentro del HUD.

Cuando la entidad alcanza al jugador:

1. Se activa un screamer.
2. Se pierde una vida.
3. El jugador reaparece.

Cuando las vidas llegan a cero se activa el estado de derrota.

---

## Sistema del enemigo

El enemigo utiliza un modelo FBX independiente.

Características:

- Modelo 3D.
- Material negro.
- Apariencia en T-pose intencional.
- Sistema de acecho.
- Sistema de persecución.
- Incremento de velocidad durante el progreso.
- Efecto VHS según la distancia.
- Activación de screamer.
- Pérdida de vidas.

Antes de restaurar la energía, la entidad aparece de manera temporal.

Después de restaurar la energía, persigue permanentemente al jugador.

---

## Cámara

El videojuego utiliza una cámara en tercera persona.

La cámara:

- Sigue al personaje.
- Puede girarse con el mouse.
- Utiliza suavizado.
- Mantiene una distancia respecto al personaje.
- Utiliza una posición tipo over-the-shoulder.
- Detecta obstáculos para reducir la distancia cuando existe una pared entre la cámara y el jugador.

---

## Sistema de interacción

El jugador puede interactuar con objetos utilizando la tecla:

`E`

Los objetos interactivos incluyen:

- Cintas VHS.
- Llave de mantenimiento.
- Fusible.
- Caja eléctrica.
- Transmisor.
- Puertas.

Las interacciones dependen de la distancia entre el personaje y el objeto.

---

## Sistema VHS

El videojuego utiliza diferentes efectos visuales para generar una estética de cinta VHS.

Entre los efectos utilizados se encuentran:

- Scanlines.
- Ruido visual.
- Aberración cromática.
- Pixelación.
- Distorsión.
- Glitches.
- Oscurecimiento de bordes.

Los efectos aumentan cuando la entidad se encuentra cerca del jugador.

---

## Estructura general del proyecto

```text
urbancore-vhs-horror/
│
├── assets/
│   │
│   ├── css/
│   │   └── styles.css
│   │
│   ├── js/
│   │   └── main.js
│   │
│   ├── models/
│   │   │
│   │   ├── character/
│   │   │   └── character.fbx
│   │   │
│   │   ├── enemy/
│   │   │   └── enemy.fbx
│   │   │
│   │   ├── environment/
│   │   │   └── model.glb
│   │   │
│   │   └── props/
│   │       ├── Idle.fbx
│   │       ├── Walking.fbx
│   │       ├── Fast Run.fbx
│   │       └── Throw.fbx
│   │
│   ├── sounds/
│   │
│   ├── textures/
│   │
│   └── screenshots/
│       ├── menu.png
│       ├── gameplay.png
│       ├── physics.png
│       └── entity.png
│
├── index.html
├── README.md
└── .


Créditos y recursos externos
Animaciones

Las animaciones utilizadas para el personaje fueron obtenidas mediante:

Mixamo

Sitio oficial:

https://www.mixamo.com/

Animaciones utilizadas:

Idle
Walking
Fast Run
Throw

Información de uso y licencias de Mixamo:

https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html

Modelos 3D

El proyecto utiliza modelos externos para:

Personaje principal.
Enemigo.
Escenario.

Antes de entregar el proyecto deben registrarse los datos de cada recurso externo.

Personaje principal
Nombre del recurso: Pendiente
Autor: Pendiente
URL: Pendiente
Licencia: Pendiente
Enemigo

El enemigo utiliza una copia modificada del modelo del personaje principal con material negro y sin animaciones.

Nombre del recurso: Pendiente
Autor: Pendiente
URL: Pendiente
Licencia: Pendiente
Escenario
Nombre del recurso: Pendiente
Autor: Pendiente
URL: Pendiente
Licencia: Pendiente
Texturas y sonidos

Los efectos visuales principales fueron generados mediante materiales, shaders y CSS.

El screamer utiliza audio generado dinámicamente mediante Web Audio API.

Si se agregan sonidos o texturas externas al proyecto, deberán registrarse indicando:

Nombre del recurso.
Autor.
URL.
Licencia.
Uso de Inteligencia Artificial

Durante el desarrollo del proyecto se utilizó Inteligencia Artificial como herramienta de apoyo.

La IA fue utilizada principalmente para:

Revisar errores de JavaScript.
Analizar mensajes de consola.
Proponer soluciones para Three.js.
Ayudar con la integración de Rapier 3D.
Revisar lógica de colisiones.
Apoyar en el desarrollo del sistema de cámara.
Revisar el sistema de animaciones FBX.
Proponer mejoras de organización del código.
Apoyar en la documentación del proyecto.
Detectar problemas de rutas y carga de modelos.
Revisar la interacción entre el personaje y los objetos.

Las propuestas generadas mediante IA fueron revisadas, probadas y modificadas durante el desarrollo.

Entre las correcciones realizadas por el alumno se encuentran:

Ajuste de rutas de modelos.
Corrección de errores de carga FBX y GLB.
Corrección del movimiento del personaje.
Ajuste de la cámara en tercera persona.
Corrección de colisiones.
Ajustes de escala del personaje.
Implementación y pruebas de Rapier 3D.
Integración de cuerpos rígidos.
Ajuste de objetos generados dinámicamente.
Sistema de interacción.
Sistema de misión.
Sistema de victoria y derrota.
Sistema de vidas.
Sistema de stamina.
Correcciones derivadas de pruebas en navegador.
Revisión de errores y advertencias mostradas en la consola.

La Inteligencia Artificial se utilizó como herramienta de apoyo y no sustituyó las pruebas, decisiones y correcciones realizadas durante el desarrollo del proyecto.

Instrucciones para ejecutar localmente

Debido a que el proyecto utiliza módulos JavaScript ES6, debe ejecutarse mediante un servidor local.

Una opción sencilla es utilizar Live Server desde Visual Studio Code.

1. Clonar el repositorio
git clone https://github.com/miltonJA12/urbancore-vhs-horror.git
2. Entrar en la carpeta
cd urbancore-vhs-horror
3. Abrir el proyecto en Visual Studio Code
code .
4. Ejecutar con Live Server

Abrir el archivo:

index.html

Después seleccionar:

Open with Live Server

La aplicación normalmente se ejecutará en una dirección similar a:

http://127.0.0.1:5500/
Requisitos recomendados

Se recomienda utilizar un navegador moderno con soporte para:

WebGL.
JavaScript ES Modules.
Web Audio API.
Pointer Lock API.
Gamepad API.

Navegadores recomendados:

Google Chrome.
Microsoft Edge.
Opera.
Opera GX.
Mozilla Firefox.
Capturas representativas

Las capturas pueden almacenarse dentro de:

assets/screenshots/
Menú principal

Gameplay

Sistema de física

Entidad

Repositorio

Repositorio público del proyecto:

https://github.com/miltonJA12/urbancore-vhs-horror

GitHub Pages

Aplicación publicada:

https://miltonja12.github.io/urbancore-vhs-horror/

La URL funcionará después de habilitar GitHub Pages para la rama main.

Autor

Milton JA

Proyecto desarrollado con fines académicos como videojuego web 3D utilizando Three.js y Rapier 3D.

Licencia

Este proyecto tiene fines académicos y educativos.

Los modelos, animaciones, texturas, sonidos y demás recursos externos mantienen las licencias establecidas por sus respectivos autores o plataformas de distribución.

El código desarrollado para este proyecto puede utilizarse con fines educativos respetando las licencias correspondientes de los recursos externos.


Solo te faltaría completar antes de entregar los datos que marqué como **Pendiente** de los modelos 3D y colocar las cuatro imágenes dentro de:

```text
assets/screenshots/

con estos nombres:

menu.png
gameplay.png
physics.png
entity.png
```
