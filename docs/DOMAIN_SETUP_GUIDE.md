# Guía de Configuración de Dominio (kelvin-vps.site)

Esta guía te ayudará a configurar tu dominio `kelvin-vps.site` para que apunte a tu VPS y a instalar el certificado SSL automáticamente.

## Paso 1: Configurar DNS en Namecheap

1.  Inicia sesión en tu cuenta de **Namecheap**.
2.  Ve a tu **Domain List** y haz clic en **Manage** junto a `kelvin-vps.site`.
3.  Ve a la pestaña **Advanced DNS**.
4.  Agrega un nuevo registro (**Add New Record**) con los siguientes datos:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| **A Record** | **@** | `86.48.24.125` | Automatic |

> **Nota:** Si ya existe un registro "A" o "CNAME" por defecto, elimínalo o edítalo.
> **Espera unos 5-10 minutos** para que los cambios se propaguen por internet.

---

## Paso 2: Ejecutar Script de Configuración en el VPS

Hemos preparado un script automático para instalar Nginx, configurar el proxy y activar SSL.

### A. Subir el script al VPS
Tienes dos opciones para poner el script en tu VPS:

**Opción 1: Crear el archivo manualmente (Más fácil si ya estás conectado)**
1.  Conéctate a tu VPS: `ssh root@86.48.24.125` (o tu usuario).
2.  Crea el archivo: `nano setup-domain.sh`
3.  Copia y pega el contenido del archivo `scripts/setup-domain.sh` que está en este proyecto.
4.  Guarda y sal (`Ctrl+O`, `Enter`, `Ctrl+X`).

**Opción 2: Subir desde tu computadora**
Si estás en la carpeta del proyecto en tu terminal local:
```bash
scp scripts/setup-domain.sh root@86.48.24.125:~/setup-domain.sh
```

### B. Ejecutar el script
Una vez que el archivo `setup-domain.sh` esté en tu VPS:

1.  Dale permisos de ejecución:
    ```bash
    chmod +x setup-domain.sh
    ```
2.  Ejecútalo:
    ```bash
    ./setup-domain.sh
    ```

El script te hará una pregunta (tu email para el certificado SSL) y hará el resto.

---

## Paso 3: Verificar

Abre tu navegador y entra a:
👉 **https://kelvin-vps.site**

¡Deberías ver tu dashboard seguro y sin puertos!
