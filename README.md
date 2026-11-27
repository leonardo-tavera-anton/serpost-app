# SERPOST App

Aplicación de escritorio implementada con Java 25 y Java Swing. El cliente utiliza el backend existente de Serpost, que conserva el acceso a la misma base de datos del proyecto.

## Ejecutar

Requisitos: JDK 25 y Maven. Desde la carpeta del proyecto:

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
mvn clean package
java -jar target/serpost-app-1.0.0.jar
```

El servicio backend predeterminado es `http://localhost:8081`. La aplicación guarda la URL configurada en **Conexión al servicio** para los siguientes inicios. Si cliente y backend están en equipos distintos, reemplaza `localhost` por la IP del equipo que ejecuta el backend.

El cliente está preparado para el perfil de desarrollo `local` y no envía tokens. Para levantar el backend vecino incluido en `Serpost_Backend`, abre otra terminal en esa carpeta y ejecuta:

```powershell
Copy-Item .env.example .env   # solo la primera vez
docker compose up --build
```

Espera a que Docker indique que el backend está listo y vuelve a pulsar **Actualizar lista**. Compose configura el perfil `local` y publica el servicio en `http://localhost:8081`. Si el cliente muestra `HTTP 401`, ese puerto está atendido por otro backend o por uno iniciado sin el perfil `local`; detén esa instancia y vuelve a iniciar el backend con el comando anterior. No uses el perfil `local` en producción. La integración de autenticación para producción queda fuera del alcance actual.

## Arquitectura

```text
Cliente Java Swing → HTTP → Backend Serpost → Base de datos existente
```

El cliente no crea otra base de datos ni se conecta directamente a ella. La comunicación HTTP usa el formato que ya acepta el backend.

## Funciones

- Registrar, consultar, actualizar y eliminar clientes.
- Registrar, consultar, actualizar estados y eliminar envíos.
- Calcular tarifas y aplicar la cotización al envío para generar una boleta.
