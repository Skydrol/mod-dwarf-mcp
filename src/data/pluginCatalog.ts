import type { PluginPort } from "../types/plugin.js";

export interface PluginCatalogEntry {
  uri: string;
  name: string;
  ports: PluginPort[];
}

export const pluginCatalog: PluginCatalogEntry[] = [
  {
    uri: "http://gareus.org/oss/lv2/tinygain#mono",
    name: "TinyGain Mono",
    ports: [
      {
        index: 0,
        symbol: "gain",
        name: "Gain",
        types: [
          "http://lv2plug.in/ns/lv2core#InputPort",
          "http://lv2plug.in/ns/lv2core#ControlPort"
        ],
        kind: "control",
        direction: "input",
        minimum: -20,
        maximum: 20,
        default: 0,
        properties: []
      },
      {
        index: 1,
        symbol: "enable",
        name: "Enable",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort",
          "http://lv2plug.in/ns/lv2core#enabled",
          "http://lv2plug.in/ns/lv2core#integer",
          "http://lv2plug.in/ns/lv2core#toggled"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 1,
        properties: ["http://lv2plug.in/ns/lv2core#integer", "http://lv2plug.in/ns/lv2core#toggled"]
      },
      {
        index: 2,
        symbol: "mute",
        name: "Mute",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort",
          "http://lv2plug.in/ns/lv2core#integer",
          "http://lv2plug.in/ns/lv2core#toggled"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0,
        properties: ["http://lv2plug.in/ns/lv2core#integer", "http://lv2plug.in/ns/lv2core#toggled"]
      },
      {
        index: 3,
        symbol: "level",
        name: "Output Level",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#OutputPort"
        ],
        kind: "control",
        direction: "output",
        minimum: 0,
        maximum: 1,
        properties: []
      },
      {
        index: 4,
        symbol: "in",
        name: "In",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort", "http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        properties: []
      },
      {
        index: 5,
        symbol: "out",
        name: "Out",
        types: [
          "http://lv2plug.in/ns/lv2core#AudioPort",
          "http://lv2plug.in/ns/lv2core#OutputPort"
        ],
        kind: "audio",
        direction: "output",
        properties: []
      }
    ]
  },
  {
    uri: "http://gareus.org/oss/lv2/tinygain#stereo",
    name: "TinyGain Stereo",
    ports: [
      {
        index: 0,
        symbol: "gain",
        name: "Gain",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: -20,
        maximum: 20,
        default: 0,
        properties: []
      },
      {
        index: 1,
        symbol: "enable",
        name: "Enable",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort",
          "http://lv2plug.in/ns/lv2core#enabled",
          "http://lv2plug.in/ns/lv2core#integer",
          "http://lv2plug.in/ns/lv2core#toggled"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 1,
        properties: ["http://lv2plug.in/ns/lv2core#integer", "http://lv2plug.in/ns/lv2core#toggled"]
      },
      {
        index: 2,
        symbol: "mute",
        name: "Mute",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort",
          "http://lv2plug.in/ns/lv2core#integer",
          "http://lv2plug.in/ns/lv2core#toggled"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0,
        properties: ["http://lv2plug.in/ns/lv2core#integer", "http://lv2plug.in/ns/lv2core#toggled"]
      },
      {
        index: 3,
        symbol: "level",
        name: "Output Level",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#OutputPort"
        ],
        kind: "control",
        direction: "output",
        minimum: 0,
        maximum: 1,
        properties: []
      },
      {
        index: 4,
        symbol: "inL",
        name: "In Left",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort", "http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        properties: []
      },
      {
        index: 5,
        symbol: "outL",
        name: "Out Left",
        types: [
          "http://lv2plug.in/ns/lv2core#AudioPort",
          "http://lv2plug.in/ns/lv2core#OutputPort"
        ],
        kind: "audio",
        direction: "output",
        properties: []
      },
      {
        index: 6,
        symbol: "inR",
        name: "In Right",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort", "http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        properties: []
      },
      {
        index: 7,
        symbol: "outR",
        name: "Out Right",
        types: [
          "http://lv2plug.in/ns/lv2core#AudioPort",
          "http://lv2plug.in/ns/lv2core#OutputPort"
        ],
        kind: "audio",
        direction: "output",
        properties: []
      }
    ]
  },
  {
    uri: "http://moddevices.com/plugins/mod-devel/Gain",
    name: "Gain",
    ports: [
      {
        index: 0,
        symbol: "In",
        name: "In",
        types: ["http://lv2plug.in/ns/lv2core#InputPort", "http://lv2plug.in/ns/lv2core#AudioPort"],
        kind: "audio",
        direction: "input",
        properties: []
      },
      {
        index: 1,
        symbol: "Out",
        name: "Out",
        types: [
          "http://lv2plug.in/ns/lv2core#AudioPort",
          "http://lv2plug.in/ns/lv2core#OutputPort"
        ],
        kind: "audio",
        direction: "output",
        properties: []
      },
      {
        index: 2,
        symbol: "Gain",
        name: "Level",
        types: [
          "http://lv2plug.in/ns/lv2core#InputPort",
          "http://lv2plug.in/ns/lv2core#ControlPort"
        ],
        kind: "control",
        direction: "input",
        minimum: -40,
        maximum: 40,
        default: 0,
        properties: []
      }
    ]
  },
  {
    uri: "http://moddevices.com/plugins/mod-devel/Gain2x2",
    name: "Gain 2x2",
    ports: [
      {
        index: 0,
        symbol: "In1",
        name: "In 1",
        types: ["http://lv2plug.in/ns/lv2core#InputPort", "http://lv2plug.in/ns/lv2core#AudioPort"],
        kind: "audio",
        direction: "input",
        properties: []
      },
      {
        index: 1,
        symbol: "In2",
        name: "In 2",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort", "http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        properties: []
      },
      {
        index: 2,
        symbol: "Out1",
        name: "Out 1",
        types: [
          "http://lv2plug.in/ns/lv2core#OutputPort",
          "http://lv2plug.in/ns/lv2core#AudioPort"
        ],
        kind: "audio",
        direction: "output",
        properties: []
      },
      {
        index: 3,
        symbol: "Out2",
        name: "Out 2",
        types: [
          "http://lv2plug.in/ns/lv2core#AudioPort",
          "http://lv2plug.in/ns/lv2core#OutputPort"
        ],
        kind: "audio",
        direction: "output",
        properties: []
      },
      {
        index: 4,
        symbol: "Gain",
        name: "Level",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: -40,
        maximum: 40,
        default: 0,
        properties: []
      }
    ]
  },
  {
    uri: "http://moddevices.com/plugins/tap/chorusflanger",
    name: "TAP Chorus/Flanger",
    ports: [
      {
        index: 0,
        symbol: "Frequency",
        name: "Frequency",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort",
          "http://moddevices.com/ns/mod#tempoRelatedDynamicScalePoints",
          "http://moddevices.com/ns/mod#tapTempo"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 5,
        default: 1.75,
        properties: [
          "http://moddevices.com/ns/mod#tempoRelatedDynamicScalePoints",
          "http://moddevices.com/ns/mod#tapTempo"
        ]
      },
      {
        index: 1,
        symbol: "LRPhaseShift",
        name: "L/R Phase Shift",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 180,
        default: 90,
        properties: []
      },
      {
        index: 2,
        symbol: "Depth",
        name: "Depth",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 75,
        properties: []
      },
      {
        index: 3,
        symbol: "Delay",
        name: "Delay",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 25,
        properties: []
      },
      {
        index: 4,
        symbol: "Contour",
        name: "Contour",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort",
          "http://lv2plug.in/ns/ext/port-props#logarithmic"
        ],
        kind: "control",
        direction: "input",
        minimum: 20,
        maximum: 20000,
        default: 100,
        properties: ["http://lv2plug.in/ns/ext/port-props#logarithmic"]
      },
      {
        index: 5,
        symbol: "DryLevel",
        name: "Dry Level",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: -90,
        maximum: 20,
        default: -3,
        properties: []
      },
      {
        index: 6,
        symbol: "WetLevel",
        name: "Wet Level",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: -90,
        maximum: 20,
        default: -3,
        properties: []
      },
      {
        index: 7,
        symbol: "InputL",
        name: "Input L",
        types: ["http://lv2plug.in/ns/lv2core#InputPort", "http://lv2plug.in/ns/lv2core#AudioPort"],
        kind: "audio",
        direction: "input",
        properties: []
      },
      {
        index: 8,
        symbol: "InputR",
        name: "Input R",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort", "http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        properties: []
      },
      {
        index: 9,
        symbol: "OutputL",
        name: "Output L",
        types: [
          "http://lv2plug.in/ns/lv2core#AudioPort",
          "http://lv2plug.in/ns/lv2core#OutputPort"
        ],
        kind: "audio",
        direction: "output",
        properties: []
      },
      {
        index: 10,
        symbol: "OutputR",
        name: "Output R",
        types: [
          "http://lv2plug.in/ns/lv2core#AudioPort",
          "http://lv2plug.in/ns/lv2core#OutputPort"
        ],
        kind: "audio",
        direction: "output",
        properties: []
      }
    ]
  },
  {
    uri: "https://ca9.eu/lv2/bolliedelay",
    name: "Bollie Delay",
    ports: [
      {
        index: 0,
        symbol: "tempo_host",
        name: "Host/MOD-Tempo",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort",
          "http://lv2plug.in/ns/ext/time#beatsPerMinute",
          "http://moddevices.com/ns/mod#tapTempo"
        ],
        kind: "control",
        direction: "input",
        minimum: 6,
        maximum: 1000,
        default: 120,
        properties: ["http://moddevices.com/ns/mod#tapTempo"]
      },
      {
        index: 1,
        symbol: "tempo_user",
        name: "User-Tempo",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 6,
        maximum: 1000,
        default: 120,
        properties: []
      },
      {
        index: 2,
        symbol: "tempo_mode",
        name: "Tempo Mode",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort",
          "http://lv2plug.in/ns/lv2core#enumeration",
          "http://lv2plug.in/ns/lv2core#integer"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 2,
        default: 0,
        properties: [
          "http://lv2plug.in/ns/lv2core#enumeration",
          "http://lv2plug.in/ns/lv2core#integer"
        ]
      },
      {
        index: 3,
        symbol: "tap",
        name: "Tap",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort",
          "http://lv2plug.in/ns/ext/port-props#trigger",
          "http://lv2plug.in/ns/lv2core#toggled",
          "http://lv2plug.in/ns/lv2core#integer"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0,
        properties: [
          "http://lv2plug.in/ns/ext/port-props#trigger",
          "http://lv2plug.in/ns/lv2core#toggled",
          "http://lv2plug.in/ns/lv2core#integer"
        ]
      },
      {
        index: 4,
        symbol: "mix",
        name: "Blend",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 30,
        properties: []
      },
      {
        index: 5,
        symbol: "feedback",
        name: "Feedback",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 40,
        properties: []
      },
      {
        index: 6,
        symbol: "crossf",
        name: "Crossfeed",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 20,
        properties: []
      },
      {
        index: 7,
        symbol: "low_on",
        name: "Low on",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort",
          "http://lv2plug.in/ns/lv2core#toggled",
          "http://lv2plug.in/ns/lv2core#integer"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0,
        properties: ["http://lv2plug.in/ns/lv2core#toggled", "http://lv2plug.in/ns/lv2core#integer"]
      },
      {
        index: 8,
        symbol: "low_f",
        name: "Low Cut Freq.",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort",
          "http://lv2plug.in/ns/ext/port-props#logarithmic"
        ],
        kind: "control",
        direction: "input",
        minimum: 20,
        maximum: 2000,
        default: 20,
        properties: ["http://lv2plug.in/ns/ext/port-props#logarithmic"]
      },
      {
        index: 9,
        symbol: "low_q",
        name: "Low Q.",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort",
          "http://lv2plug.in/ns/ext/port-props#logarithmic"
        ],
        kind: "control",
        direction: "input",
        minimum: 0.125,
        maximum: 8,
        default: 1,
        properties: ["http://lv2plug.in/ns/ext/port-props#logarithmic"]
      },
      {
        index: 10,
        symbol: "high_on",
        name: "High on",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort",
          "http://lv2plug.in/ns/lv2core#toggled",
          "http://lv2plug.in/ns/lv2core#integer"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0,
        properties: ["http://lv2plug.in/ns/lv2core#toggled", "http://lv2plug.in/ns/lv2core#integer"]
      },
      {
        index: 11,
        symbol: "high_f",
        name: "High Cut Freq.",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort",
          "http://lv2plug.in/ns/ext/port-props#logarithmic"
        ],
        kind: "control",
        direction: "input",
        minimum: 200,
        maximum: 22000,
        default: 7500,
        properties: ["http://lv2plug.in/ns/ext/port-props#logarithmic"]
      },
      {
        index: 12,
        symbol: "high_q",
        name: "High Q.",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort",
          "http://lv2plug.in/ns/ext/port-props#logarithmic"
        ],
        kind: "control",
        direction: "input",
        minimum: 0.125,
        maximum: 8,
        default: 1,
        properties: ["http://lv2plug.in/ns/ext/port-props#logarithmic"]
      },
      {
        index: 13,
        symbol: "div_l",
        name: "Div. L",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort",
          "http://lv2plug.in/ns/lv2core#integer",
          "http://lv2plug.in/ns/lv2core#enumeration"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 5,
        default: 0,
        properties: [
          "http://lv2plug.in/ns/lv2core#integer",
          "http://lv2plug.in/ns/lv2core#enumeration"
        ]
      },
      {
        index: 14,
        symbol: "div_r",
        name: "Div. R",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort",
          "http://lv2plug.in/ns/lv2core#integer",
          "http://lv2plug.in/ns/lv2core#enumeration"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 5,
        default: 0,
        properties: [
          "http://lv2plug.in/ns/lv2core#integer",
          "http://lv2plug.in/ns/lv2core#enumeration"
        ]
      },
      {
        index: 15,
        symbol: "in_l",
        name: "In L",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort", "http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        properties: []
      },
      {
        index: 16,
        symbol: "in_r",
        name: "In R",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort", "http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        properties: []
      },
      {
        index: 17,
        symbol: "out_l",
        name: "Out L",
        types: [
          "http://lv2plug.in/ns/lv2core#OutputPort",
          "http://lv2plug.in/ns/lv2core#AudioPort"
        ],
        kind: "audio",
        direction: "output",
        properties: []
      },
      {
        index: 18,
        symbol: "out_r",
        name: "Out R",
        types: [
          "http://lv2plug.in/ns/lv2core#AudioPort",
          "http://lv2plug.in/ns/lv2core#OutputPort"
        ],
        kind: "audio",
        direction: "output",
        properties: []
      },
      {
        index: 19,
        symbol: "tempo_out",
        name: "Current tempo",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#OutputPort"
        ],
        kind: "control",
        direction: "output",
        minimum: 6,
        maximum: 1000,
        default: 120,
        properties: []
      }
    ]
  },
  {
    uri: "https://github.com/michaelwillis/dragonfly-reverb",
    name: "Dragonfly Hall Reverb",
    ports: [
      {
        index: 0,
        symbol: "lv2_audio_in_1",
        name: "Audio Input 1",
        types: ["http://lv2plug.in/ns/lv2core#InputPort", "http://lv2plug.in/ns/lv2core#AudioPort"],
        kind: "audio",
        direction: "input",
        properties: []
      },
      {
        index: 1,
        symbol: "lv2_audio_in_2",
        name: "Audio Input 2",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort", "http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        properties: []
      },
      {
        index: 2,
        symbol: "lv2_audio_out_1",
        name: "Audio Output 1",
        types: [
          "http://lv2plug.in/ns/lv2core#AudioPort",
          "http://lv2plug.in/ns/lv2core#OutputPort"
        ],
        kind: "audio",
        direction: "output",
        properties: []
      },
      {
        index: 3,
        symbol: "lv2_audio_out_2",
        name: "Audio Output 2",
        types: [
          "http://lv2plug.in/ns/lv2core#AudioPort",
          "http://lv2plug.in/ns/lv2core#OutputPort"
        ],
        kind: "audio",
        direction: "output",
        properties: []
      },
      {
        index: 4,
        symbol: "lv2_events_in",
        name: "Events Input",
        types: ["http://lv2plug.in/ns/ext/atom#AtomPort", "http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "atom",
        direction: "input",
        properties: []
      },
      {
        index: 5,
        symbol: "lv2_events_out",
        name: "Events Output",
        types: [
          "http://lv2plug.in/ns/ext/atom#AtomPort",
          "http://lv2plug.in/ns/lv2core#OutputPort"
        ],
        kind: "atom",
        direction: "output",
        properties: []
      },
      {
        index: 6,
        symbol: "dry_level",
        name: "Dry Level",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 80,
        properties: []
      },
      {
        index: 7,
        symbol: "early_level",
        name: "Early Level",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 10,
        properties: []
      },
      {
        index: 8,
        symbol: "late_level",
        name: "Late Level",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 20,
        properties: []
      },
      {
        index: 9,
        symbol: "size",
        name: "Size",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 10,
        maximum: 60,
        default: 24,
        properties: []
      },
      {
        index: 10,
        symbol: "width",
        name: "Width",
        types: [
          "http://lv2plug.in/ns/lv2core#InputPort",
          "http://lv2plug.in/ns/lv2core#ControlPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 50,
        maximum: 150,
        default: 100,
        properties: []
      },
      {
        index: 11,
        symbol: "delay",
        name: "Predelay",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 4,
        properties: []
      },
      {
        index: 12,
        symbol: "diffuse",
        name: "Diffuse",
        types: [
          "http://lv2plug.in/ns/lv2core#InputPort",
          "http://lv2plug.in/ns/lv2core#ControlPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 90,
        properties: []
      },
      {
        index: 13,
        symbol: "low_cut",
        name: "Low Cut",
        types: [
          "http://lv2plug.in/ns/lv2core#InputPort",
          "http://lv2plug.in/ns/lv2core#ControlPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 200,
        default: 4,
        properties: []
      },
      {
        index: 14,
        symbol: "low_xo",
        name: "Low Cross",
        types: [
          "http://lv2plug.in/ns/lv2core#InputPort",
          "http://lv2plug.in/ns/lv2core#ControlPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 200,
        maximum: 1200,
        default: 500,
        properties: []
      },
      {
        index: 15,
        symbol: "low_mult",
        name: "Low Mult",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 0.5,
        maximum: 2.5,
        default: 1.3,
        properties: []
      },
      {
        index: 16,
        symbol: "high_cut",
        name: "High Cut",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 1000,
        maximum: 16000,
        default: 7600,
        properties: []
      },
      {
        index: 17,
        symbol: "high_xo",
        name: "High Cross",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 1000,
        maximum: 16000,
        default: 5500,
        properties: []
      },
      {
        index: 18,
        symbol: "high_mult",
        name: "High Mult",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 0.2,
        maximum: 1.2,
        default: 0.5,
        properties: []
      },
      {
        index: 19,
        symbol: "spin",
        name: "Spin",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 10,
        default: 3.3,
        properties: []
      },
      {
        index: 20,
        symbol: "wander",
        name: "Wander",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 40,
        default: 15,
        properties: []
      },
      {
        index: 21,
        symbol: "decay",
        name: "Decay",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 0.1,
        maximum: 10,
        default: 1.3,
        properties: []
      },
      {
        index: 22,
        symbol: "early_send",
        name: "Early Send",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 20,
        properties: []
      },
      {
        index: 23,
        symbol: "modulation",
        name: "Modulation",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 15,
        properties: []
      }
    ]
  },
  {
    uri: "http://distrho.sf.net/plugins/MVerb",
    name: "MVerb",
    ports: [
      {
        index: 0,
        symbol: "lv2_audio_in_1",
        name: "Audio Input 1",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort", "http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        properties: []
      },
      {
        index: 1,
        symbol: "lv2_audio_in_2",
        name: "Audio Input 2",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort", "http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        properties: []
      },
      {
        index: 2,
        symbol: "lv2_audio_out_1",
        name: "Audio Output 1",
        types: [
          "http://lv2plug.in/ns/lv2core#AudioPort",
          "http://lv2plug.in/ns/lv2core#OutputPort"
        ],
        kind: "audio",
        direction: "output",
        properties: []
      },
      {
        index: 3,
        symbol: "lv2_audio_out_2",
        name: "Audio Output 2",
        types: [
          "http://lv2plug.in/ns/lv2core#AudioPort",
          "http://lv2plug.in/ns/lv2core#OutputPort"
        ],
        kind: "audio",
        direction: "output",
        properties: []
      },
      {
        index: 4,
        symbol: "damping",
        name: "Damping",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 50,
        properties: []
      },
      {
        index: 5,
        symbol: "density",
        name: "Density",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 50,
        properties: []
      },
      {
        index: 6,
        symbol: "bandwidth",
        name: "Bandwidth",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 50,
        properties: []
      },
      {
        index: 7,
        symbol: "decay",
        name: "Decay",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 50,
        properties: []
      },
      {
        index: 8,
        symbol: "predelay",
        name: "Predelay",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 50,
        properties: []
      },
      {
        index: 9,
        symbol: "size",
        name: "Size",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 5,
        maximum: 100,
        default: 75,
        properties: []
      },
      {
        index: 10,
        symbol: "gain",
        name: "Gain",
        types: [
          "http://lv2plug.in/ns/lv2core#InputPort",
          "http://lv2plug.in/ns/lv2core#ControlPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 100,
        properties: []
      },
      {
        index: 11,
        symbol: "mix",
        name: "Mix",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 50,
        properties: []
      },
      {
        index: 12,
        symbol: "earlymix",
        name: "Early/Late Mix",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 50,
        properties: []
      }
    ]
  },
  {
    uri: "http://moddevices.com/plugins/mod-devel/cabsim-vintage",
    name: "Vintage Cabinets",
    ports: [
      {
        index: 0,
        symbol: "In",
        name: "Input",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort", "http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        properties: []
      },
      {
        index: 1,
        symbol: "Out",
        name: "Output",
        types: [
          "http://lv2plug.in/ns/lv2core#AudioPort",
          "http://lv2plug.in/ns/lv2core#OutputPort"
        ],
        kind: "audio",
        direction: "output",
        properties: []
      },
      {
        index: 2,
        symbol: "Attenuation",
        name: "Attenuation",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: -90,
        maximum: 0,
        default: -2,
        properties: []
      },
      {
        index: 3,
        symbol: "Model",
        name: "Model",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort",
          "http://lv2plug.in/ns/lv2core#enumeration",
          "http://lv2plug.in/ns/lv2core#integer"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 12,
        default: 0,
        properties: [
          "http://lv2plug.in/ns/lv2core#enumeration",
          "http://lv2plug.in/ns/lv2core#integer"
        ]
      },
      {
        index: 4,
        symbol: "Fidelity",
        name: "Fidelity",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort",
          "http://lv2plug.in/ns/ext/port-props#notOnGUI",
          "http://lv2plug.in/ns/lv2core#integer"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0,
        properties: [
          "http://lv2plug.in/ns/ext/port-props#notOnGUI",
          "http://lv2plug.in/ns/lv2core#integer"
        ]
      },
      {
        index: 5,
        symbol: "Enabled",
        name: "Enabled",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort",
          "http://lv2plug.in/ns/lv2core#enabled",
          "http://lv2plug.in/ns/lv2core#integer",
          "http://lv2plug.in/ns/lv2core#toggled"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 1,
        properties: ["http://lv2plug.in/ns/lv2core#integer", "http://lv2plug.in/ns/lv2core#toggled"]
      }
    ]
  },
  {
    uri: "http://aidadsp.cc/plugins/aidadsp-bundle/rt-neural-generic",
    name: "AIDA-X",
    ports: [
      {
        index: 0,
        symbol: "IN",
        name: "IN",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort", "http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        properties: []
      },
      {
        index: 1,
        symbol: "OUT",
        name: "OUT",
        types: [
          "http://lv2plug.in/ns/lv2core#AudioPort",
          "http://lv2plug.in/ns/lv2core#OutputPort"
        ],
        kind: "audio",
        direction: "output",
        properties: []
      },
      {
        index: 2,
        symbol: "CONTROL",
        name: "CONTROL",
        types: [
          "http://lv2plug.in/ns/ext/atom#AtomPort",
          "http://lv2plug.in/ns/lv2core#InputPort",
          "http://lv2plug.in/ns/lv2core#control"
        ],
        kind: "atom",
        direction: "input",
        properties: []
      },
      {
        index: 3,
        symbol: "NOTIFY",
        name: "NOTIFY",
        types: [
          "http://lv2plug.in/ns/ext/atom#AtomPort",
          "http://lv2plug.in/ns/lv2core#OutputPort",
          "http://lv2plug.in/ns/lv2core#control"
        ],
        kind: "atom",
        direction: "output",
        properties: []
      },
      {
        index: 4,
        symbol: "ANTIALIASING",
        name: "ANTIALIASING",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 66.216003,
        properties: []
      },
      {
        index: 5,
        symbol: "PREGAIN",
        name: "INPUT",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: -12,
        maximum: 12,
        default: 0,
        properties: []
      },
      {
        index: 6,
        symbol: "NETBYPASS",
        name: "NETBYPASS",
        types: [
          "http://lv2plug.in/ns/lv2core#InputPort",
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#toggled",
          "http://lv2plug.in/ns/lv2core#integer"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0,
        properties: ["http://lv2plug.in/ns/lv2core#toggled", "http://lv2plug.in/ns/lv2core#integer"]
      },
      {
        index: 7,
        symbol: "PARAM1",
        name: "PARAM1",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0,
        properties: []
      },
      {
        index: 8,
        symbol: "PARAM2",
        name: "PARAM2",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0,
        properties: []
      },
      {
        index: 9,
        symbol: "EQBYPASS",
        name: "EQBYPASS",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort",
          "http://lv2plug.in/ns/lv2core#toggled",
          "http://lv2plug.in/ns/lv2core#integer"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0,
        properties: ["http://lv2plug.in/ns/lv2core#toggled", "http://lv2plug.in/ns/lv2core#integer"]
      },
      {
        index: 10,
        symbol: "EQPOS",
        name: "EQPOS",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort",
          "http://lv2plug.in/ns/lv2core#enumeration",
          "http://lv2plug.in/ns/lv2core#integer"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0,
        properties: [
          "http://lv2plug.in/ns/lv2core#enumeration",
          "http://lv2plug.in/ns/lv2core#integer"
        ]
      },
      {
        index: 11,
        symbol: "BASS",
        name: "BASS",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: -8,
        maximum: 8,
        default: 0,
        properties: []
      },
      {
        index: 12,
        symbol: "BFREQ",
        name: "BFREQ",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 75,
        maximum: 600,
        default: 305,
        properties: []
      },
      {
        index: 13,
        symbol: "MID",
        name: "MID",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: -8,
        maximum: 8,
        default: 0,
        properties: []
      },
      {
        index: 14,
        symbol: "MFREQ",
        name: "MFREQ",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 150,
        maximum: 5000,
        default: 750,
        properties: []
      },
      {
        index: 15,
        symbol: "MIDQ",
        name: "MIDQ",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 0.2,
        maximum: 5,
        default: 0.707,
        properties: []
      },
      {
        index: 16,
        symbol: "MTYPE",
        name: "MTYPE",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort",
          "http://lv2plug.in/ns/lv2core#enumeration",
          "http://lv2plug.in/ns/lv2core#integer"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0,
        properties: [
          "http://lv2plug.in/ns/lv2core#enumeration",
          "http://lv2plug.in/ns/lv2core#integer"
        ]
      },
      {
        index: 17,
        symbol: "TREBLE",
        name: "TREBLE",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: -8,
        maximum: 8,
        default: 0,
        properties: []
      },
      {
        index: 18,
        symbol: "TFREQ",
        name: "TFREQ",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: 1000,
        maximum: 4000,
        default: 2000,
        properties: []
      },
      {
        index: 19,
        symbol: "DEPTH",
        name: "DEPTH",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: -8,
        maximum: 8,
        default: 0,
        properties: []
      },
      {
        index: 20,
        symbol: "PRESENCE",
        name: "PRESENCE",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: -8,
        maximum: 8,
        default: 0,
        properties: []
      },
      {
        index: 21,
        symbol: "DCBLOCKER",
        name: "DCBLOCKER",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort",
          "http://lv2plug.in/ns/lv2core#integer",
          "http://lv2plug.in/ns/lv2core#toggled"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 1,
        properties: ["http://lv2plug.in/ns/lv2core#integer", "http://lv2plug.in/ns/lv2core#toggled"]
      },
      {
        index: 22,
        symbol: "MASTER",
        name: "OUTPUT",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort"
        ],
        kind: "control",
        direction: "input",
        minimum: -15,
        maximum: 15,
        default: 0,
        properties: []
      },
      {
        index: 23,
        symbol: "ModelInSize",
        name: "Model Input Size",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#OutputPort",
          "http://lv2plug.in/ns/lv2core#enumeration",
          "http://lv2plug.in/ns/lv2core#integer"
        ],
        kind: "control",
        direction: "output",
        minimum: 0,
        maximum: 3,
        default: 0,
        properties: [
          "http://lv2plug.in/ns/lv2core#enumeration",
          "http://lv2plug.in/ns/lv2core#integer"
        ]
      },
      {
        index: 24,
        symbol: "enabled",
        name: "Enabled",
        types: [
          "http://lv2plug.in/ns/lv2core#ControlPort",
          "http://lv2plug.in/ns/lv2core#InputPort",
          "http://lv2plug.in/ns/lv2core#enabled"
        ],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 1,
        properties: []
      }
    ]
  }
] as PluginCatalogEntry[];
