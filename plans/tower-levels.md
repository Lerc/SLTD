# Tower levels

All towers begin at level 1. Leveling keeps the same tower, targeting, kills and damage credit. Branching retains the level and applies the new type’s curves. There is no fixed level cap.

Let `n = level - 1`. Damage multiplies by `1 + a*n^p`. Firing rate and range multiply by `1 + cap*(1-exp(-k*n))`; bounded curves prevent rapid-fire and range growth from erasing weapon identities. Stats are always recalculated from the unmodified type values, never compounded from an already leveled value.

The price of the next level is `ceil(firstPrice * currentLevel^priceExponent / 5) * 5`. For example, Sentry costs 40, 110, 200 and 300 credits for levels 2–5. Branch prices are separate incremental costs.

The coefficients below are the values in `srv/levels.js`. Damage columns are `(a,p)`; rate/range columns are `(cap,k)`.

| Tower | Focus | First level price | Price exponent | Damage | Rate | Range |
|---|---|---:|---:|---|---|---|
| Sentry | Balanced generalist | 40 | 1.45 | 0.38, 1.12 | 0.65, 0.2 | 0.32, 0.16 |
| Cannon | Heavy close-range hits | 55 | 1.48 | 0.55, 1.18 | 0.28, 0.12 | 0.24, 0.15 |
| Pulse | Fast energy fire | 60 | 1.44 | 0.25, 1.1 | 1.2, 0.27 | 0.22, 0.12 |
| Incinerator | Burn strength | 50 | 1.46 | 0.18, 1.08 | 0.5, 0.15 | 0.3, 0.12 |
| Nova | Expanding area coverage | 65 | 1.5 | 0.3, 1.08 | 0.45, 0.14 | 0.8, 0.28 |
| Ranger | Piercing damage and reach | 95 | 1.52 | 0.45, 1.2 | 0.35, 0.1 | 0.55, 0.22 |
| Repeater | Rapid firing | 100 | 1.48 | 0.2, 1.05 | 1.9, 0.32 | 0.18, 0.11 |
| Mortar | Heavy damage and splash | 120 | 1.55 | 0.58, 1.22 | 0.22, 0.09 | 0.42, 0.18 |
| Orbital | Heavy spirals; smaller blind spot | 140 | 1.58 | 0.65, 1.24 | 0.4, 0.16 | 0.28, 0.13 |
| Inferno | Intense long-lasting burns | 110 | 1.51 | 0.22, 1.09 | 0.6, 0.18 | 0.2, 0.1 |
| Firestorm | Wide splash coverage | 125 | 1.54 | 0.32, 1.13 | 0.32, 0.11 | 0.46, 0.19 |
| Tesla | More links and chain reach | 130 | 1.53 | 0.28, 1.11 | 0.7, 0.21 | 0.38, 0.17 |
| Prism | Focused energy damage | 130 | 1.56 | 0.34, 1.16 | 0.95, 0.25 | 0.35, 0.14 |
| Railgun | Very heavy, slow shots | 175 | 1.62 | 0.7, 1.28 | 0.18, 0.08 | 0.36, 0.2 |
| Executioner | Finishing damage | 160 | 1.57 | 0.48, 1.21 | 0.55, 0.19 | 0.26, 0.09 |
| Cryo | Slow strength and coverage | 100 | 1.49 | 0.16, 1.04 | 0.38, 0.13 | 0.7, 0.24 |
| Quake | Damage and field coverage | 125 | 1.54 | 0.5, 1.17 | 0.25, 0.1 | 0.62, 0.23 |

Incinerator and Inferno emphasize burning damage and duration; Firestorm emphasizes splash radius. Mortar also widens its splash. Tesla gains up to four extra links and greater link distance. Cryo and Quake strengthen and lengthen their slows, with a minimum speed factor of 0.22. Orbital’s blind spot narrows as its range grows, but never disappears. These effect curves are also in `srv/levels.js`.

The level control displays the largest percentage gain among damage, firing rate, range, burn power and splash. Full tower descriptions remain in the paused field guide. Projectiles snapshot damage when fired; existing shots do not gain damage retroactively.
