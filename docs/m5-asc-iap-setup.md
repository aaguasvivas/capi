# M5: App Store Connect IAP setup (do once, ~15 minutes)

Create all 8 products now; the review screenshot per product can be added later
(it is only required when the 1.1 version is submitted). Do not submit any
product on its own; they ride along with the 1.1 app submission.

Path: App Store Connect → My Apps → Capi → Monetization → In-App Purchases →
"+" → **Non-Consumable** for every row.

For each product: set Reference Name and Product ID exactly as below, set the
USD price, then add BOTH localizations (English (U.S.) and Spanish (Mexico)).
Display name limit is 30 characters, description limit 45; these fit.

| # | Reference Name (internal) | Product ID | USD |
|---|---------------------------|------------|-----|
| 1 | Remove Ads | `capi.remove_ads` | 1.99 |
| 2 | Mesa Quisqueya | `capi.mesa.quisqueya` | 0.99 |
| 3 | Mesa Larimar | `capi.mesa.larimar` | 0.99 |
| 4 | Mesa Capi Noche | `capi.mesa.noche` | 0.99 |
| 5 | Fichas Quisqueya | `capi.fichas.quisqueya` | 0.99 |
| 6 | Fichas Borinquen | `capi.fichas.borinquen` | 0.99 |
| 7 | Fichas Kingston | `capi.fichas.kingston` | 0.99 |
| 8 | Todo Capi | `capi.todo` | 4.99 |

Localizations:

| Product ID | EN name | EN description | ES name | ES description |
|------------|---------|----------------|---------|----------------|
| `capi.remove_ads` | Remove Ads | No more banner ads, forever. | Quitar anuncios | Sin anuncios para siempre. |
| `capi.mesa.quisqueya` | Quisqueya Table | Navy felt table with gold piping. | Mesa Quisqueya | Mesa azul marino con dorado. |
| `capi.mesa.larimar` | Larimar Table | Deep teal felt, larimar calm. | Mesa Larimar | Fieltro verde azulado larimar. |
| `capi.mesa.noche` | Capi Noche Table | Dark felt, indigo neon, gold. | Mesa Capi Noche | Fieltro oscuro, neón y oro. |
| `capi.fichas.quisqueya` | Quisqueya Tiles | Ivory tiles, DR flag backs. | Fichas Quisqueya | Fichas marfil, bandera RD. |
| `capi.fichas.borinquen` | Borinquen Tiles | White tiles, PR flag backs. | Fichas Borinquen | Fichas blancas, bandera PR. |
| `capi.fichas.kingston` | Kingston Tiles | Black gold tiles, JM flag backs. | Fichas Kingston | Fichas negras, bandera JM. |
| `capi.todo` | All of Capi | Everything: no ads and all designs. | Todo Capi | Todo: sin anuncios y 6 diseños. |

Notes:
- `capi.todo` is a single non-consumable that the app treats as unlocking
  everything. It is NOT an Apple "app bundle"; just a normal product.
- Availability: all countries (default).
- Review screenshot: one per product, added right before the 1.1 submission.
  I will generate them from the store sheet UI when it exists.
- The Paid Applications agreement is already signed (done for Anota), so
  products go straight to "Ready to Submit" once metadata is complete.
