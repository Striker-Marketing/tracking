# Striker Tracking Script

Script de rastreamento client-side que captura eventos de `page view` e `form submit`, enriquece com identificadores do usuário e dados do formulário, e envia para o `dataLayer` do Google Tag Manager (consumido pelo Meta Pixel e pela Conversions API via GTM server-side).

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
- Se o [Umami](https://docs.umami.is/docs/tracker-functions) estiver na página, chama `umami.identify(external_id)`. Se o Umami carregar depois deste script, a chamada acontece no evento `load` ou, se ainda não estiver pronto, em novas tentativas a cada 500 ms por até 10 s.

### 2. UTMs e click IDs (last touch)

- Ao carregar a página, salva em cookie (90 dias, mesmo nome do parâmetro) cada parâmetro da URL que começa com `utm_` ou é um click ID: `gclid`, `fbclid`, `msclkid`, `ttclid`, `twclid`, `dclid`, `wbraid`, `gbraid`, `igshid`, `gad_source`, `gad_campaignid`, `tbclid`.
- Modelo **last touch**: se a URL tiver pelo menos um desses parâmetros, todos os cookies salvos antes são apagados e o conjunto novo é salvo. Assim, origens de visitas diferentes nunca se misturam (ex.: `utm_source=facebook` antigo com `gclid` novo).
- Se a URL não tiver nenhum desses parâmetros, os cookies não mudam. Assim, o lead enviado em outra página ainda carrega a origem da visita.
- 90 dias é a validade dos click IDs na Meta e no Google. Os valores são salvos sem alteração (click IDs diferenciam maiúsculas e minúsculas).
- Os cookies são gravados no domínio raiz (ex.: `.example.com`), então todos os subdomínios compartilham os mesmos dados.

### 3. `_fbc` e `_fbp` (Conversions API)

- Se a URL tiver `fbclid` e o cookie `_fbc` não existir ou tiver outro `fbclid`, o script grava `_fbc` no formato da Meta: `fb.<subdomainIndex>.<timestamp em ms>.<fbclid>`, por 90 dias.
- `fbc` e `fbp` (cookie `_fbp`, criado pelo Meta Pixel) são enviados nos dois eventos, **sem hash**, como a Meta exige.
- Na primeira página de uma visita, `fbp` pode faltar se o Pixel ainda não tiver carregado.
- IP e user agent não são enviados: o GTM server-side os obtém do próprio request.

## Eventos disparados

### Campos comuns aos dois eventos

| Campo         | Origem                                                        |
| ------------- | ------------------------------------------------------------- |
| `event_id`    | UUID v4 único por evento (deduplicação na Meta)               |
| `external_id` | ID persistente do usuário (cookie `striker_user_id`)          |
| `url_params`  | Objeto com UTMs e click IDs (cookies + URL atual)             |
| `campaign`    | `utm_campaign` ou, se vazio, `gad_campaignid`                 |
| `keyword`     | `utm_term`                                                    |
| `adSource`    | Plataforma do click ID: `google`, `facebook`, `taboola`, `bing`, `tiktok` |
| `referrer`    | `document.referrer`                                           |
| `page.url`    | `location.href`                                               |
| `page.title`  | `document.title`                                              |
| `domain`      | `location.hostname`                                           |
| `gaClientId`  | Client ID do Google Analytics (cookie `_ga`)                  |
| `timestamp`   | Momento do evento, em milissegundos                           |
| `fbc`         | Cookie `_fbc` (só quando existe)                              |
| `fbp`         | Cookie `_fbp` (só quando existe)                              |

### `striker_page_view`

Disparado automaticamente ao carregar a página. Envia apenas os campos comuns.

### `striker_form_submit`

Disparado manualmente ao submeter um formulário. Envia os campos comuns, `user_id` (quando passado como segundo argumento) e `userData`.

`userData` contém os dados do formulário **normalizados** no formato do Advanced Matching da Meta, **sem hash**. O hash é feito no GTM. Campos vazios são omitidos.

| Campo     | Origem                                                            | Normalização                                    |
| --------- | ----------------------------------------------------------------- | ----------------------------------------------- |
| `em`      | Input `[type="email"]` ou `name`: `email`, `e-mail`, `e_mail` | trim + minúsculas                               |
| `ph`      | Input `[type="tel"]` ou `name`: `phone_number`, `phone`, `telefone`, `celular`, `whatsapp`, `fone` | só dígitos, com código do país, sem zeros à esquerda (ver abaixo) |
| `fn`      | `name`: `first_name`, `primeiro_nome`, `nome_primeiro` (ou primeira palavra do nome completo) | minúsculas, sem acentos, só letras              |
| `ln`      | `name`: `last_name`, `sobrenome`, `ultimo_nome` (ou resto do nome completo / primeiro nome) | idem                                          |
| `zp`      | `name`: `zip`, `postal_code`, `cep` | minúsculas, só letras e dígitos (`EC1A 1BB` → `ec1a1bb`); EUA: 5 primeiros dígitos |
| `ct`      | `name`: `city`, `cidade`, `municipio` | minúsculas, sem acentos, só letras              |
| `st`      | `name`: `state`, `estado`, `uf` | sigla de 2 letras em minúsculas; nome de estado brasileiro vira a UF (`São Paulo` → `sp`); outros: minúsculas, só letras |
| `country` | `name`: `country`, `pais` | código ISO 3166-1 alfa-2 em minúsculas (`Brasil` → `br`); nome desconhecido é omitido |
| `external_id` | Cookie `striker_user_id` | igual ao `external_id` do evento |

Regras do telefone (`ph`):

1. Começa com `+` ou `00`: número internacional, só os dígitos são mantidos (`+1 212 555 1234` → `12125551234`).
2. Senão, zeros à esquerda são removidos, e o código de operadora brasileiro também (`0 21 11 98765-4321` → `11987654321`).
3. Se o país for `br` ou estiver vazio e o número tiver formato brasileiro (DDD + 8 dígitos, ou DDD + 9 + 8 dígitos), ganha `55`.
4. Se o país for outro, os dígitos ficam como estão (o script não sabe o código daquele país). Para leads de fora do Brasil, peça o número com `+` e o código do país.

### Exemplo

```js
{
  event: "striker_form_submit",
  event_id: "92f0fc35-2213-423f-a591-8c66a98375ca",
  external_id: "a00a806b-bed8-4f2d-918f-9eb694331566",
  user_id: "u1",
  url_params: { utm_source: "facebook", utm_campaign: "bf2026", fbclid: "IwAR123" },
  campaign: "bf2026",
  keyword: "",
  adSource: "facebook",
  referrer: "https://example.com/?utm_source=facebook&utm_campaign=bf2026&fbclid=IwAR123",
  page: { url: "https://example.com/contato", title: "Contato" },
  domain: "example.com",
  gaClientId: "1234567890.1761650000",
  timestamp: 1761650042000,
  fbc: "fb.1.1761650000000.IwAR123",
  fbp: "fb.1.1761650000000.1116446470",
  userData: {
    em: "ana@example.com",
    ph: "5511987654321",
    fn: "ana",
    ln: "mariasouza",
    st: "sp",
    country: "br",
    external_id: "a00a806b-bed8-4f2d-918f-9eb694331566",
  },
}
```

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

- **Nome completo**: use `name="full_name"`, `name="name"`, `name="nome"` ou `name="nome_completo"` (será dividido em primeiro nome e sobrenome).
- **Nome separado**: use `name="first_name"` / `primeiro_nome` / `nome_primeiro` e `name="last_name"` / `sobrenome` / `ultimo_nome`.
- **Nome único**: se apenas o primeiro nome for preenchido, o valor será dividido em primeiro e sobrenome.

## Integração com GTM

No Google Tag Manager, crie triggers do tipo **Custom Event** para os nomes:

- `striker_page_view`
- `striker_form_submit`

E configure variáveis do tipo **Data Layer Variable** para cada campo desejado (`event_id`, `external_id`, `url_params.utm_source`, `userData.em`, etc.). No Advanced Matching do Pixel, mapeie os campos de `userData`. Os valores chegam sem hash; o GTM (ou a tag do Pixel) faz o hash. `fbc` e `fbp` nunca recebem hash.

### Deduplicação Pixel + Conversions API

- Use o mesmo `event_id` como `eventID` na tag do Pixel e como `event_id` na Conversions API.
- Use exatamente o mesmo nome de evento nos dois (`Lead` ≠ `lead`).
- A Meta só deduplica eventos que chegam com até 48 h de diferença.

## Dependências

- Nenhuma dependência externa.
- Requer suporte a `URLSearchParams` e `window.crypto.getRandomValues` (com fallback para `Math.random`).
