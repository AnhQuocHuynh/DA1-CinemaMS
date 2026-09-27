# Keycloak Setup Guide: Cinema Booking System

This guide outlines the step-by-step process to configure Keycloak as the centralized Identity and Access Management (IAM) provider for the Cinema Booking System, ensuring seamless integration with the new microservices architecture without breaking legacy downstream services.

> [!IMPORTANT]
> **Compatibility Goal**: Legacy downstream services expect a `Long` user ID (`userId`), while Keycloak uses string `UUID`s (`sub`). We preserve this logic by having Keycloak act purely as the auth provider, while the new `Identity Service` maps Keycloak UUIDs to internal `Long` IDs and the API Gateway forwards the `Long` ID to downstream services via the `X-User-Id` header.

---

## 1. Initial Keycloak Setup & Realm Creation

1. **Start Keycloak**: Run Keycloak locally via Docker.
   ```bash
   docker run -p 8080:8080 -e KEYCLOAK_ADMIN=admin -e KEYCLOAK_ADMIN_PASSWORD=admin quay.io/keycloak/keycloak:latest start-dev
   ```
2. **Access Admin Console**: Navigate to `http://localhost:8080/admin` and log in with `admin` / `admin`.
3. **Create Realm**:
   - In the top-left dropdown, click **Create Realm**.
   - **Realm Name**: `cinema-booking`
   - Click **Create**.

---

## 2. Configure Realm Settings

1. Navigate to **Realm Settings** > **Login** tab.
2. Enable the following toggles:
   - **User registration**: `ON` (Allows customers to sign up)
   - **Forgot password**: `ON`
   - **Verify email**: `ON` (Optional but recommended)
   - **Login with email**: `ON`
3. Navigate to **Realm Settings** > **Security Defenses** > **Brute Force Detection**.
   - Ensure it is enabled (e.g., Lockout after 5 failures for 30 seconds).

---

## 3. Define Realm Roles

To preserve the legacy authorization logic, we need to replicate the roles used in the old monolith (`CUSTOMER`, `ADMIN`, `STAFF`).

1. Navigate to **Realm Roles** > **Create Role**.
2. Create the following roles:
   - `CUSTOMER`
   - `ADMIN`
   - `STAFF`
3. **Set Default Role**:
   - Navigate to **Realm Roles** > **Default Roles** tab.
   - Select `CUSTOMER` and add it to the default roles. (This ensures every newly registered user automatically gets the `CUSTOMER` role).

---

## 4. Client Configuration

You need to create three clients to handle different authentication flows.

### Client 1: `cinema-frontend` (React SPA)
1. Navigate to **Clients** > **Create client**.
2. **Client ID**: `cinema-frontend`
3. **Client Type**: `OpenID Connect`
4. **Next**, enable **Standard Flow** (Authorization Code Flow with PKCE).
5. **Next**, configure URLs:
   - **Valid redirect URIs**: `http://localhost:3000/*` (or your React app URL)
   - **Web origins**: `*` (or `http://localhost:3000`)
   - **Valid post logout redirect URIs**: `http://localhost:3000/*`
6. Click **Save**.
7. Go to the **Advanced** tab of the client, set **Proof Key for Code Exchange Code Challenge Method (PKCE)** to `S256`.

### Client 2: `cinema-api-gateway` (YARP)
1. **Create client** with **Client ID**: `cinema-api-gateway`
2. **Client authentication**: `ON` (Makes it a Confidential client)
3. **Service accounts roles**: `ON`
4. Click **Save**.
5. Go to the **Credentials** tab and copy the **Client Secret**. Keep this safe; the Gateway will use it to interact with Keycloak.

### Client 3: `cinema-admin` (Keycloak Admin REST API)
1. **Create client** with **Client ID**: `cinema-admin`
2. **Client authentication**: `ON`
3. **Service accounts roles**: `ON`
4. Click **Save**.
5. Go to the **Service account roles** tab, click **Assign role**, filter by clients, select `realm-management`, and assign roles like `manage-users`, `view-users`. (This allows the Identity Service to query/sync Keycloak users if needed).

---

## 5. Token & Claims Configuration

To map roles properly, the JWT needs to contain the realm roles in a predictable format (`realm_access.roles`). By default, Keycloak does this.

1. Navigate to **Client Scopes** > `roles` > **Mappers**.
2. Ensure there is a mapper named `realm roles`.
3. Verify its configuration:
   - **Mapper Type**: `User Realm Role`
   - **Token Claim Name**: `realm_access.roles`
   - **Add to ID token**: `ON`
   - **Add to access token**: `ON`

---

## 6. Developing the Custom Event Listener SPI

The legacy backend used a `Long` ID for users. To bridge this, the new `Identity Service` needs to know when a user registers in Keycloak so it can create a local mapping (`keycloak_id` <-> `internal_long_id`). We achieve this by writing a custom Event Listener Service Provider Interface (SPI) for Keycloak that publishes an event to RabbitMQ whenever a new user registers.

### 6.1 Project Setup (`pom.xml`)

Create a new Maven project with the following dependencies. Ensure the `keycloak.version` matches your Keycloak Docker image version.

```xml
<dependencies>
    <!-- Keycloak SPI dependencies (provided scope as they are available in Keycloak runtime) -->
    <dependency>
        <groupId>org.keycloak</groupId>
        <artifactId>keycloak-server-spi</artifactId>
        <version>${keycloak.version}</version>
        <scope>provided</scope>
    </dependency>
    <dependency>
        <groupId>org.keycloak</groupId>
        <artifactId>keycloak-server-spi-private</artifactId>
        <version>${keycloak.version}</version>
        <scope>provided</scope>
    </dependency>
    <dependency>
        <groupId>org.keycloak</groupId>
        <artifactId>keycloak-services</artifactId>
        <version>${keycloak.version}</version>
        <scope>provided</scope>
    </dependency>
    
    <!-- RabbitMQ Client for publishing events -->
    <dependency>
        <groupId>com.rabbitmq</groupId>
        <artifactId>amqp-client</artifactId>
        <version>5.20.0</version>
    </dependency>

    <!-- JSON processing -->
    <dependency>
        <groupId>com.fasterxml.jackson.core</groupId>
        <artifactId>jackson-databind</artifactId>
        <version>2.15.2</version>
    </dependency>
</dependencies>
```

### 6.2 Implement the Event Listener Provider Factory

The factory is responsible for creating instances of our listener and configuring the RabbitMQ connection.

```java
package com.cinema.keycloak.events;

import org.keycloak.Config;
import org.keycloak.events.EventListenerProvider;
import org.keycloak.events.EventListenerProviderFactory;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;

public class RabbitMqEventListenerProviderFactory implements EventListenerProviderFactory {

    private static final String PROVIDER_ID = "rabbitmq-event-listener";
    private RabbitMqPublisher publisher;

    @Override
    public EventListenerProvider create(KeycloakSession session) {
        return new RabbitMqEventListenerProvider(session, publisher);
    }

    @Override
    public void init(Config.Scope config) {
        // Initialize RabbitMQ publisher connection here
        // E.g. read host, port, credentials from env vars
        String host = System.getenv().getOrDefault("RABBITMQ_HOST", "localhost");
        this.publisher = new RabbitMqPublisher(host);
    }

    @Override
    public void postInit(KeycloakSessionFactory factory) { }

    @Override
    public void close() {
        if (publisher != null) {
            publisher.close();
        }
    }

    @Override
    public String getId() {
        return PROVIDER_ID;
    }
}
```

### 6.3 Implement the Event Listener Provider

The provider intercepts both user-level events (`EventType`) and admin events (`AdminEvent`). The actual implementation covers **four** lifecycle paths:

| Event Source | Trigger | Routing Key Published |
|---|---|---|
| `EventType.REGISTER` | User self-registers via login page / PKCE flow | `user.registered` |
| `EventType.DELETE_ACCOUNT` | User self-deletes their own account | `user.deleted` |
| `AdminEvent CREATE USER` | Admin creates user via Admin Console / Admin REST API | `user.registered` |
| `AdminEvent DELETE USER` | Admin deletes user via Admin Console / Admin REST API | `user.deleted` |

```java
package com.cinema.keycloak.events;

import org.keycloak.events.Event;
import org.keycloak.events.EventListenerProvider;
import org.keycloak.events.EventType;
import org.keycloak.events.admin.AdminEvent;
import org.keycloak.events.admin.OperationType;
import org.keycloak.events.admin.ResourceType;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.UserModel;

import java.util.HashMap;
import java.util.Map;

public class RabbitMqEventListenerProvider implements EventListenerProvider {

    private final KeycloakSession session;
    private final RabbitMqPublisher publisher;

    public RabbitMqEventListenerProvider(KeycloakSession session, RabbitMqPublisher publisher) {
        this.session = session;
        this.publisher = publisher;
    }

    @Override
    public void onEvent(Event event) {
        if (event.getType() == EventType.REGISTER) {
            // User self-registered via the Keycloak login/registration page
            Map<String, Object> payload = new HashMap<>();
            payload.put("KeycloakId", event.getUserId());
            payload.put("Email", event.getDetails().get("email"));
            payload.put("FirstName", event.getDetails().get("first_name"));
            payload.put("LastName", event.getDetails().get("last_name"));
            payload.put("Phone", event.getDetails().get("custom_attributes.phone"));
            payload.put("Gender", event.getDetails().get("custom_attributes.gender"));

            publisher.publish("user.events", "user.registered", payload);

        } else if (event.getType() == EventType.DELETE_ACCOUNT) {
            // User self-deleted their account
            Map<String, Object> payload = new HashMap<>();
            payload.put("KeycloakId", event.getUserId());
            publisher.publish("user.events", "user.deleted", payload);
        }
    }

    @Override
    public void onEvent(AdminEvent adminEvent, boolean includeRepresentation) {
        if (adminEvent.getResourceType() == ResourceType.USER) {
            // resourcePath is e.g. "users/1234-5678-..."
            String resourcePath = adminEvent.getResourcePath();
            String userId = resourcePath != null && resourcePath.startsWith("users/")
                    ? resourcePath.substring(6)
                    : resourcePath;

            if (adminEvent.getOperationType() == OperationType.CREATE && userId != null) {
                // Admin created a user — look up full UserModel to get all attributes
                UserModel user = session.users().getUserById(session.getContext().getRealm(), userId);
                if (user != null) {
                    Map<String, Object> payload = new HashMap<>();
                    payload.put("KeycloakId", userId);
                    payload.put("Email", user.getEmail());
                    payload.put("FirstName", user.getFirstName());
                    payload.put("LastName", user.getLastName());
                    payload.put("Phone", user.getFirstAttribute("phone"));
                    payload.put("Gender", user.getFirstAttribute("gender"));
                    publisher.publish("user.events", "user.registered", payload);
                }

            } else if (adminEvent.getOperationType() == OperationType.DELETE && userId != null) {
                // Admin deleted a user
                Map<String, Object> payload = new HashMap<>();
                payload.put("KeycloakId", userId);
                publisher.publish("user.events", "user.deleted", payload);
            }
        }
    }

    @Override
    public void close() { }
}
```

> **Note**: You will need to implement the `RabbitMqPublisher` class to handle the actual AMQP logic using the `amqp-client`.

### 6.4 Register the SPI

For Keycloak to discover your SPI, you must create a service descriptor file.

Create a file named `org.keycloak.events.EventListenerProviderFactory` inside the `src/main/resources/META-INF/services/` directory with the following content (the fully qualified class name of your factory):

```text
com.cinema.keycloak.events.RabbitMqEventListenerProviderFactory
```

### 6.5 Build and Deploy

1. Build the project using Maven: `mvn clean package`. Note that you may need to create a fat JAR (using maven-assembly-plugin or maven-shade-plugin) to include the `amqp-client` and `jackson` dependencies, as they are not provided by Keycloak.
2. Copy the resulting `.jar` file into the `/opt/keycloak/providers/` directory of your Keycloak container. If using Docker Compose, you can mount it as a volume:
   ```yaml
   volumes:
     - ./my-spi/target/my-spi-fat.jar:/opt/keycloak/providers/my-spi.jar
   ```
3. Restart the Keycloak container. The new SPI will be picked up during startup (Keycloak automatically builds the provider registry if the container is started with `start-dev`, otherwise you must run `kc.sh build`).
4. **Enable the Listener**:
   - Go to Keycloak Admin Console.
   - Navigate to **Realm Settings** > **Events** tab.
   - In the **Event Listeners** field, add your provider ID: `rabbitmq-event-listener`.
   - Click **Save**.

---

## 7. Gateway Routing & Compatibility Flow

1. **Intercept the Request**: Gateway receives `Authorization: Bearer <JWT>`.
2. **Validate JWT**: Gateway validates signature against Keycloak JWKS.
3. **Extract UUID & Roles**: Gateway extracts `sub` and `realm_access.roles`.
4. **Resolve Internal ID**:
   - Gateway calls Identity Service: `GET /internal/users/resolve?keycloakId={sub}`
5. **Header Injection**: Gateway strips JWT and injects headers:
   - `X-User-Id: 1234`
   - `X-Keycloak-Id: <UUID>`
   - `X-User-Roles: CUSTOMER`

---

## 8. Customizing Keycloak UI to Match React Frontend

To ensure users have a seamless experience, you must apply a custom Keycloak theme so that the login and registration pages mirror your React frontend's design, including custom user data fields.

### 8.1 Create the Theme Structure (Docker Compose)
Keycloak uses FreeMarker templates (`.ftl`) for UI. Since Keycloak is running via Docker Compose, you should mount your custom theme directory as a volume so that changes to the UI are reflected without rebuilding the container.

1. Create a `themes/cinema-theme` folder in your project's infrastructure directory (e.g., next to your `docker-compose.yml`). The structure should look like this:
   ```text
   infrastructure/
   ├── docker-compose.yml
   └── keycloak-themes/
       └── cinema-theme/
           ├── login/
           │   ├── theme.properties
           │   ├── login.ftl          (Login page)
           │   ├── register.ftl       (Registration page)
           │   └── resources/
           │       ├── css/styles.css (Copy React CSS here)
           │       ├── js/script.js
           │       └── img/logo.png
   ```

2. Update your `docker-compose.yml` to mount this directory into the Keycloak container's `/opt/keycloak/themes` directory:
   ```yaml
   services:
     keycloak:
       image: quay.io/keycloak/keycloak:latest
       command: start-dev
       environment:
         - KEYCLOAK_ADMIN=admin
         - KEYCLOAK_ADMIN_PASSWORD=admin
       ports:
         - "8080:8080"
       volumes:
         - ./keycloak-themes/cinema-theme:/opt/keycloak/themes/cinema-theme
   ```

3. Edit `theme.properties` to inherit from the default theme but load your CSS:
   ```properties
   parent=keycloak
   import=common/keycloak
   styles=css/styles.css
   ```

### 8.2 Declarative User Profile (Adding Custom Data Fields)
We need to capture additional user data (like Phone, Gender, Date of Birth) directly during Keycloak registration.
1. In Keycloak Admin, navigate to **Realm Settings** > **User Profile** tab.
2. Click **Create Attribute** for each custom field you need:
   - **Name**: `phone`
   - **Display Name**: `Phone Number`
   - **Required**: `ON` (if mandatory)
   - **Permissions**: User can view and edit (`ON`).
   - Repeat for `gender` and `date_of_birth`.
3. Keycloak will now automatically enforce these fields when `register.ftl` is rendered using the default template.

### 8.3 Customizing `login.ftl` and `register.ftl`
To make it look exactly like your React app, you override the `.ftl` files. You can copy the raw HTML/CSS from your React components and wrap it in Keycloak's FreeMarker tags, converting `className` to `class`.

**Converted `register.ftl` based on your React Frontend:**
```html
<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=!messagesPerField.existsError('global'); section>
    <#if section = "header">
        Create Account
    <#elseif section = "form">
        <!-- Using the Tailwind classes from SignUp.tsx -->
        <form id="kc-register-form" action="${url.registrationAction}" method="post" class="space-y-6">
            <div class="grid grid-cols-1 gap-6">
                
                <div class="space-y-1.5">
                    <label for="firstName" class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-1">First Name <span class="text-error">*</span></label>
                    <div class="relative">
                        <input id="firstName" name="firstName" type="text" placeholder="John" class="w-full pl-4 pr-4 py-3 bg-surface-container-highest border-none rounded-lg focus:ring-0 text-sm placeholder:text-outline-variant transition-all border-b-2 border-transparent focus:border-primary" />
                    </div>
                </div>
                
                <div class="space-y-1.5">
                    <label for="lastName" class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-1">Last Name <span class="text-error">*</span></label>
                    <div class="relative">
                        <input id="lastName" name="lastName" type="text" placeholder="Doe" class="w-full pl-4 pr-4 py-3 bg-surface-container-highest border-none rounded-lg focus:ring-0 text-sm placeholder:text-outline-variant transition-all border-b-2 border-transparent focus:border-primary" />
                    </div>
                </div>

                <div class="space-y-1.5">
                    <label for="email" class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-1">Email Address <span class="text-error">*</span></label>
                    <div class="relative">
                        <input id="email" name="email" type="email" placeholder="name@company.com" class="w-full pl-4 pr-4 py-3 bg-surface-container-highest border-none rounded-lg focus:ring-0 text-sm placeholder:text-outline-variant transition-all border-b-2 border-transparent focus:border-primary" />
                    </div>
                </div>
                
                <div class="space-y-1.5">
                    <label for="phone" class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-1">Phone Number</label>
                    <div class="relative">
                        <!-- Custom Attribute Mapping -->
                        <input id="phone" name="user.attributes.phone" type="tel" placeholder="123-456-7890" class="w-full pl-4 pr-4 py-3 bg-surface-container-highest border-none rounded-lg focus:ring-0 text-sm placeholder:text-outline-variant transition-all border-b-2 border-transparent focus:border-primary" />
                    </div>
                </div>
            </div>

            <div class="space-y-1.5">
                <label for="password" class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-1">Password <span class="text-error">*</span></label>
                <div class="relative">
                    <input id="password" name="password" type="password" placeholder="••••••••" class="w-full pl-4 pr-4 py-3 bg-surface-container-highest border-none rounded-lg focus:ring-0 text-sm placeholder:text-outline-variant transition-all border-b-2 border-transparent focus:border-primary" />
                </div>
                <p class="text-[11px] text-on-surface-variant px-1">Use at least 6 characters with a mix of letters and numbers.</p>
            </div>

            <div class="space-y-1.5">
                <label for="password-confirm" class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-1">Confirm Password <span class="text-error">*</span></label>
                <div class="relative">
                    <input id="password-confirm" name="password-confirm" type="password" placeholder="••••••••" class="w-full pl-4 pr-4 py-3 bg-surface-container-highest border-none rounded-lg focus:ring-0 text-sm placeholder:text-outline-variant transition-all border-b-2 border-transparent focus:border-primary" />
                </div>
            </div>

            <div class="pt-2 space-y-4">
                <button type="submit" class="w-full py-4 bg-blue-600 text-white rounded-lg font-bold text-sm tracking-wide shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                    CREATE ACCOUNT
                </button>
            </div>
        </form>
    </#if>
</@layout.registrationLayout>
```

> [!NOTE]
> By naming the input fields `user.attributes.<attribute_name>`, Keycloak automatically parses and saves these into the user's custom attributes map.

### 8.4 Apply the Theme to the Realm
1. Navigate to **Realm Settings** > **Themes** tab.
2. Set **Login Theme** to `cinema-theme`.
3. Click **Save**.
4. The login and registration flows will now use your custom React-styled HTML, CSS, and capture the necessary extended user data seamlessly!
