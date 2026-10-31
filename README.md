# 🪟 Sistema de Pautas de Corte — Aluminio & Cristales

Sistema web para el cálculo automático de **pautas de corte de aluminio**, generación de cotizaciones y gestión de precios de perfiles y accesorios.

---

## 📋 Descripción

Aplicación web desarrollada para optimizar el cálculo preciso de cortes de perfiles de aluminio y cristales para:

- **Ventanas Correderas** — Serie AL/15, AL/20, AL/25, L5000
- **Doble Contacto** — Proyectantes, Abatir, AL/32, AL/42
- **Shower Doors** — Receptáculo, Tinas AM-12
- **Puertas** — Abatir, Vaivén, Marcos
- **Paños Fijos** — AL/32, AL/42, Tubos

---

## ✨ Funcionalidades

| Módulo | Descripción |
|---|---|
| 🧮 **Pautas de Corte** | Wizard paso a paso para calcular cortes exactos (mm) por tipo de producto y sub-tipo |
| 📐 **Vista Previa** | Canvas esquemático del producto con dimensiones en tiempo real y edición de cotas interactiva |
| 💰 **Tabla de Precios** | Edición en línea de precios de perfiles y accesorios, con exportación JSON |
| 📋 **Cotización** | Panel flotante con múltiples ítems, subtotal, IVA y total |
| 🖨️ **Impresión / PDF** | Generación de pauta de corte en PDF y cotización imprimible |

---

## 🛠️ Tecnologías

- **Backend**: Node.js + Express
- **Frontend**: HTML5, CSS3 Vanilla, JavaScript ES6+
- **Fuentes**: Inter + JetBrains Mono (Google Fonts)
- **Canvas API**: Vista previa esquemática de productos con interactividad CAD
- **Sin frameworks**: Sin React, Vue ni dependencias pesadas

---

## 🚀 Instalación y Uso

### Requisitos
- Node.js v16 o superior
- npm

### Pasos

```bash
# Clonar el repositorio
git clone https://github.com/crist38/Aluminio.git
cd Aluminio

# Instalar dependencias
npm install

# Iniciar el servidor (APP_PASSWORD: mínimo 12 caracteres)
APP_PASSWORD="una_contraseña_larga" node server.js
```

La aplicación estará disponible en: [http://localhost:3000](http://localhost:3000)

**Acceso:** toda la aplicación pide la contraseña de la variable `APP_PASSWORD`. Sin esa variable nadie puede entrar; en Vercel hay que definirla en el proyecto. Al cambiarla se cierran todas las sesiones.

---

## 📁 Estructura del Proyecto

```
aluminio-web/
├── public/
│   ├── index.html          # Página principal (SPA)
│   ├── logo.png            # Logo de la aplicación
│   ├── css/
│   │   └── styles.css      # Estilos premium dark/light mode
│   └── js/
│       ├── app.js          # Controlador principal de secciones
│       ├── wizard.js       # Lógica del wizard de cortes
│       ├── calculos.js     # Motor de cálculo de pautas
│       ├── canvas-draw.js  # Dibujo en canvas (vista previa)
│       ├── precios.js      # Módulo de tabla de precios
│       └── cotizacion.js   # Módulo de cotización
├── data/                   # Datos de perfiles y precios (JSON)
├── server.js               # Servidor Express
├── package.json
└── README.md
```

---

## 👨‍💻 Desarrollador

Desarrollado por **Cristian Pereira**
