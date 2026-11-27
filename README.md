# SERPOST App

Aplicacion de escritorio para Windows basada en Java 25 y Java Swing.

## Desarrollo

```powershell
npm install
npm run dev
```

El backend predeterminado es `http://localhost:3001`. Puede cambiarse desde **Configuracion** dentro de la aplicacion.

## Operaciones disponibles

- Registrar clientes mediante `POST /clientes`
- Consultar clientes por UUID mediante `GET /clientes/{id_cliente}`
- Actualizar clientes mediante `PUT /clientes/{id_cliente}`

## Pruebas del backend

En la aplicacion use **Pruebas del backend** para ejecutar una serie de casos
contra el servicio configurado:

- Rechazo sin autenticacion Bearer
- Registro de un cliente
- Consulta por UUID
- Actualizacion del cliente
- Rechazo de documentos duplicados
- Validacion de campos obligatorios

Cada caso muestra su estado HTTP, tiempo de respuesta, resultado esperado y
cuerpo devuelto por el backend.

El backend protege las operaciones con OAuth2 JWT. Configure un Bearer token valido en **Configuracion**.

## Instalar en Windows

```powershell
npm run dist
```

El instalador NSIS se genera en `release/`.
