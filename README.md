# Striker Tracking Script

Script de rastreamento client-side que captura eventos de `page view` e `form submit`, enriquece com dados de geolocalização e identificadores do usuário, e envia para o `dataLayer` do Google Tag Manager.

## Instalação

Inclua o script em todas as páginas que devem ser rastreadas, preferencialmente dentro do `<head>` com o atributo `defer`:

```html
<script defer src="https://cdn.jsdelivr.net/gh/Striker-Marketing/tracking@2/script.min.js"></script>
```

O script executa automaticamente ao ser carregado via `initStrikerTracking()`.

## Funcionamento

### 1. Identificação do usuário

- Gera um `external_id` (UUID v4) na primeira visita e persiste em cookie (`striker_user_id`) por 365 dias.
- Reaproveita o mesmo ID em visitas subsequentes.

### 2. Geolocalização por IP

- Consulta a API pública `https://free.freeipapi.com/api/json` para obter IP, CEP, cidade, estado e país.
- Armazena os dados em cookies (`user_ip`, `user_ip_zip`, `user_ip_city`, `user_ip_state`, `user_ip_country`) para evitar chamadas repetidas.
- O cookie `user_ip` expira em 1 dia; os demais em 365 dias.

### 3. Cookies do Facebook

Captura automaticamente:
- `_fbc` — clique atribuído ao Facebook (ou monta a partir do parâmetro `fbclid` da URL).
- `_fbp` — cookie de pixel do Facebook.

## Eventos disparados

### `striker_page_view`

Disparado automaticamente ao carregar a página. Envia:

| Campo         | Origem                                    |
| ------------- | ----------------------------------------- |
| `event_id`    | UUID v4 único por evento                  |
| `external_id` | ID persistente do usuário                 |
| `user_ip`     | IP detectado                              |
| `zip`         | CEP detectado por IP                      |
| `city`        | Cidade detectada por IP                   |
| `state`       | Estado detectado por IP                   |
| `country`     | País detectado por IP                     |
| `user_agent`  | `navigator.userAgent`                     |
| `user_fbc`    | Cookie `_fbc` ou derivado de `fbclid`     |
| `user_fbp`    | Cookie `_fbp`                             |

### `striker_form_submit`

Disparado manualmente ao submeter um formulário. Envia os campos acima (exceto os de geo por IP, que são substituídos pelos valores do formulário quando presentes) além de:

| Campo        | Origem                                                                 |
| ------------ | ---------------------------------------------------------------------- |
| `email`      | Input `[type="email"]` ou `[name="email"]`                             |
| `first_name` | Input `[name="first_name"]` (ou primeira palavra de `full_name`)       |
| `last_name`  | Input `[name="last_name"]` (ou resto de `full_name` / `first_name`)    |
| `phone`      | Input `[type="tel"]`, `[name="phone_number"]` ou `[name="phone"]`      |
| `zip`        | Input `[name="zip"]` ou `[name="postal_code"]`                         |
| `city`       | Input `[name="city"]`                                                  |
| `state`      | Input `[name="state"]`                                                 |
| `country`    | Input `[name="country"]`                                               |

Os valores de `zip`, `city`, `state` e `country` do formulário sobrescrevem os cookies de geolocalização por IP.

## Uso em formulários

Exponha o script no `window` como `triggerStrikerLead`. Chame no evento `submit`:

```html
<form id="lead-form">
  <input type="email" name="email" required />
  <input name="full_name" required />
  <input type="tel" name="phone" required />
  <input name="zip" />
  <button type="submit">Enviar</button>
</form>

<script>
  document.getElementById("lead-form").addEventListener("submit", (e) => {
    window.triggerStrikerLead(e.target);
  });
</script>
```

### Convenção de nomes dos campos

Para que o script consiga extrair corretamente os dados, use um dos padrões abaixo:

- **Nome completo**: use `name="full_name"` (será dividido em `first_name` e `last_name`).
- **Nome separado**: use `name="first_name"` e `name="last_name"`.
- **Nome único**: se apenas `first_name` for preenchido, o valor será dividido em primeiro e sobrenome.

## Integração com GTM

No Google Tag Manager, crie triggers do tipo **Custom Event** para os nomes:

- `striker_page_view`
- `striker_form_submit`

E configure variáveis do tipo **Data Layer Variable** para cada campo desejado (`email`, `external_id`, `user_ip`, etc.).

## Dependências

- Nenhuma dependência externa além da API `free.freeipapi.com` para geolocalização.
- Requer suporte a `fetch`, `URLSearchParams` e `window.crypto.getRandomValues` (com fallback para `Math.random`).
