# ZK Bridge Electron

**ZK Bridge Electron** es una aplicación de escritorio multiplataforma desarrollada con Electron y Node.js que actúa como puente (bridge) entre terminales de control de acceso ZKTeco F22 y un backend central. Su propósito principal es facilitar la recolección de registros de asistencia, su almacenamiento local en archivos JSON y la sincronización automática (o manual) con sistemas centrales, todo a través de una interfaz gráfica simple y amigable.

---

## Características

- **Lectura automática de registros** desde múltiples terminales ZKTeco F22.
- **Almacenamiento local offline** de registros en archivos JSON para garantizar cero pérdida de datos ante caídas de red.
- **Sincronización automática/manual** de registros pendientes con un backend central vía API REST.
- **Interfaz de usuario minimalista** para operadores no técnicos (por ejemplo, guardias de seguridad).
- **Manejo y visualización de errores** de conexión y sincronización.
- **Configuración sencilla** de dispositivos y endpoint backend.

---

## Estructura del Proyecto

```
zk-bridge-electron/
│
├── main.js               # Proceso principal Electron
├── preload.js            # Comunicación segura entre frontend y backend
├── renderer/
│   ├── index.html        # Interfaz de usuario
│   └── renderer.js       # Lógica de la interfaz
├── src/
│   ├── api.js            # Lógica central y estado del bridge
│   ├── config.js         # Configuración de dispositivos y backend
│   ├── deviceManager.js  # Polling y conexión con terminales ZKTeco
│   ├── offlineStore.js   # Manejo de registros offline en JSON
│   ├── syncService.js    # Sincronización con backend
├── offline_logs/         # Carpeta donde se guardan los logs pendientes
├── package.json
└── README.md
```

---

## Instalación y Ejecución

> **Requisitos:** Node.js >= 18, acceso de red a las terminales ZKTeco F22, endpoint backend funcional.

1. **Clona o descarga este repositorio.**

2. **Instala las dependencias:**

   ```sh
   npm install
   ```

3. **Configura los dispositivos y el backend** en `src/config.js`.

4. **Ejecuta la aplicación:**

   ```sh
   npm start
   ```

5. **(Opcional) Empaqueta como instalador** (requiere electron-builder):
   ```sh
   npm run build
   ```

---

## Uso

- Al iniciar, la app intentará conectarse a cada terminal F22 configurada, leer los registros nuevos y guardarlos en `offline_logs/`.
- Los registros pendientes se sincronizan automáticamente con el backend cuando hay conectividad.
- El estado de la aplicación, últimos eventos y errores se visualizan en la ventana principal.
- El operador puede forzar la sincronización manualmente desde la interfaz.

---

## Personalización

- Modifica `src/config.js` para agregar o remover terminales, cambiar el endpoint backend o intervalos de polling/sincronización.
- Personaliza la interfaz en `renderer/index.html` y `renderer/renderer.js` según necesidades.

---

## Seguridad

- Los archivos de log almacenan solo información básica: ID de usuario, timestamp, tipo de evento y terminal.
- El acceso al backend está protegido mediante una clave API configurable.

---

## Soporte

Para dudas, sugerencias o reportes de error, contacta al equipo de desarrollo o abre un issue en el repositorio correspondiente.

---

## Licencia

MIT License

---
