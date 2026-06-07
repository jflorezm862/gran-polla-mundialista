# 🏆 Gran Polla Mundialista 2026
## Guía completa de configuración y publicación

---

## PASO 1 — Instalar Node.js
Descarga e instala Node.js desde: https://nodejs.org (versión LTS)

---

## PASO 2 — Configurar Firebase

### 2.1 Crear el proyecto
1. Ve a https://console.firebase.google.com
2. Clic en **"Agregar proyecto"**
3. Nombre: `gran-polla-mundialista`
4. Desactiva Google Analytics (opcional)
5. Clic en **"Crear proyecto"**

### 2.2 Activar Authentication
1. En el menú izquierdo → **Build → Authentication**
2. Clic en **"Comenzar"**
3. Pestaña **"Sign-in method"**
4. Activa **Correo electrónico/Contraseña** → Guardar

### 2.3 Crear la base de datos Firestore
1. En el menú izquierdo → **Build → Firestore Database**
2. Clic en **"Crear base de datos"**
3. Selecciona **"Comenzar en modo de producción"**
4. Elige la ubicación: `us-central1` (o la más cercana a Colombia)
5. Clic en **"Listo"**

### 2.4 Configurar reglas de seguridad Firestore
En Firestore → pestaña **"Reglas"**, reemplaza todo con:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Perfiles de usuario — solo el dueño puede escribir
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    // Pronósticos — solo el dueño puede escribir
    match /predictions/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    // Resultados compartidos — solo admins pueden escribir
    match /shared/{docId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
  }
}
```

Clic en **"Publicar"**

### 2.5 Obtener las credenciales de tu app
1. En Firebase → ícono de engranaje ⚙️ → **"Configuración del proyecto"**
2. Sección **"Tus apps"** → Clic en el ícono `</>`  (Web)
3. Nombre de la app: `gran-polla-web`
4. NO actives Firebase Hosting (usaremos Vercel)
5. Copia el objeto `firebaseConfig` que aparece

### 2.6 Pegar las credenciales en el proyecto
Abre el archivo `src/firebase.js` y reemplaza los valores:

```js
const firebaseConfig = {
  apiKey:            "AIzaSy...",          // ← tu valor real
  authDomain:        "gran-polla-mundialista.firebaseapp.com",
  projectId:         "gran-polla-mundialista",
  storageBucket:     "gran-polla-mundialista.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc123",
};
```

---

## PASO 3 — Instalar y probar localmente

Abre una terminal en la carpeta `gran-polla-mundialista` y ejecuta:

```bash
npm install
npm run dev
```

Abre http://localhost:5173 en tu navegador.

### Crear el primer usuario Admin
1. Regístrate normalmente en la app
2. Ve a Firebase Console → Firestore → colección `users`
3. Busca tu documento (es tu UID)
4. Edita el campo `isAdmin` → cámbialo a `true`
5. Ahora verás el menú "⚙️ Admin" en la app

---

## PASO 4 — Publicar en Vercel (gratis)

### 4.1 Subir el código a GitHub
1. Crea una cuenta en https://github.com
2. Crea un repositorio nuevo llamado `gran-polla-mundialista`
3. En la terminal:
```bash
git init
git add .
git commit -m "Gran Polla Mundialista 2026"
git remote add origin https://github.com/TU_USUARIO/gran-polla-mundialista.git
git push -u origin main
```

### 4.2 Desplegar en Vercel
1. Ve a https://vercel.com y crea una cuenta (gratis)
2. Clic en **"Add New Project"**
3. Importa tu repositorio de GitHub
4. Framework: **Vite** (lo detecta automáticamente)
5. Clic en **"Deploy"**
6. En ~2 minutos tu app estará en: `gran-polla-mundialista.vercel.app`

---

## PASO 5 — Conectar dominio propio (opcional)

### Comprar el dominio
- https://www.namecheap.com (recomendado, ~$10/año)
- Busca `granpollamundialista.com` o similar

### Conectar en Vercel
1. En tu proyecto Vercel → **Settings → Domains**
2. Escribe tu dominio y sigue las instrucciones de DNS
3. En Namecheap → Advanced DNS → agrega los registros que Vercel indica
4. En ~24 horas el dominio apunta a tu app ✅

---

## PASO 6 — Agregar Firebase a los dominios autorizados

Para que Firebase Auth funcione con tu dominio propio:
1. Firebase Console → Authentication → Settings → **Authorized domains**
2. Clic en **"Add domain"**
3. Agrega: `granpollamundialista.com` (o el que hayas comprado)
4. Agrega también: `gran-polla-mundialista.vercel.app`

---

## Estructura del proyecto

```
gran-polla-mundialista/
├── index.html              ← entrada principal
├── package.json            ← dependencias
├── vite.config.js          ← configuración Vite
├── public/
│   └── favicon.svg         ← logo del balón Colombia
└── src/
    ├── main.jsx            ← montaje React
    ├── firebase.js         ← ⚠️ EDITAR con tus credenciales
    └── App.jsx             ← toda la aplicación
```

## Arquitectura Firebase

```
Firestore
├── users/
│   └── {uid}               → {name, email, isAdmin, createdAt}
├── predictions/
│   └── {uid}               → {matches:{}, groups:{}, champ:{}}
└── shared/
    └── results             → {matches:{matchId:{home,away}}, updatedAt}
```

---

## ¿Problemas?

- **Error de CORS en la API de Claude**: normal en desarrollo local.
  Usa un proxy o prueba directamente desde el dominio publicado.
- **Reglas de Firestore "permission-denied"**: revisa que las reglas
  del Paso 2.4 estén publicadas correctamente.
- **La app no carga**: verifica que `src/firebase.js` tiene tus credenciales reales.

---

*Gran Polla Mundialista 2026 — Carlos Hernando Florez*
