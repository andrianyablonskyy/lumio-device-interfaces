# 11. Device types

Every hardware type declares what kind of product it is: `device_type` in the HW type (manufacturer API, `POST
/v1/mfr/hw-types`). The app groups its "Add device" catalogue by type, draws devices by type, and runs a guided
setup for some types. The channels of the HW type must fit its type; a registration or update whose channels do not
fit is refused with `validation_failed` and one error per problem on `capabilities`.

| `device_type` | Product | Channels it must have | It may also have |
| --- | --- | --- | --- |
| `power_switch` | Wall switch, 1–4 gangs | 1–4 `switch` actuators | `power_meter`, `energy` |
| `relay` | Relay module with several outputs | 2–16 `switch` actuators | `power_meter`, `energy`, `voltage`, `current`, `contact` (inputs) |
| `meter` | Electricity, water or gas meter | 1–16 sensors of `power_meter`, `energy`, `voltage`, `current`, `volume` | `battery` |
| `valve` | Water or gas valve | 1–4 `valve` actuators | `water_leak`, `battery`, `temperature`, `volume` |
| `smart_socket` | Plug or power strip | 1–6 `switch` actuators | `power_meter`, `energy`, `voltage`, `current`, `temperature` |
| `light_bulb` | Light bulb | exactly 1 `dimmer` actuator; at most 1 each of `switch`, `color_temp`, `rgb_light` actuators | — |
| `control_panel` | Wall panel with scene buttons | 1–16 `button` sensors | `switch`, `temperature`, `humidity`, `illuminance`, `motion` |
| `dimmer` | Dimmer, 1–4 channels | 1–4 `dimmer` actuators | `switch`, `power_meter`, `energy` |
| `climate_sensor` | Thermometer and hygrometer | 1 `temperature` and 1 `humidity` sensor | `battery`, `illuminance`, `co2` |
| `custom` | Anything else (the default) | — | any |

Custom capabilities (`x_…`) are allowed in every type; the app shows them as generic values. A channel only counts
for a requirement with the right role: a `temperature` actuator does not satisfy a climate sensor.

## Light bulbs

The app tells three kinds of bulb apart by their channels, so there is no separate field:

| Variant | Channels |
| --- | --- |
| White | `dimmer` (brightness) |
| Tunable white ("two-colour white") | `dimmer` + `color_temp` (Kelvin, give the `range`, e.g. 2700–6500) |
| RGB | `dimmer` + `rgb_light` (optionally `color_temp` too) |

## Switches and relays

Wall switches and relay modules get the app's guided setup: safety and wiring advice, the model's own pairing
instructions (`setup_instructions`, write them for every language you support), connecting, then naming every output.
Each `switch` actuator is one output: name the channels `switch_1` … `switch_N` in the order printed on the device,
because the app lists them in that order ("Channel 1", "Channel 2", …) and shows one tile per output on the home
screen. Report the state of every output in `state/reported` (`{"switch_1": true, "switch_2": false}`).

Example: [openapi/mfr.yaml](../openapi/mfr.yaml), example `HwTypeReqRelay`.
