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
,
{
    uri: "http://moddevices.com/plugins/mod-devel/DS1",
    name: "DS1",
    ports: [
      {
        index: 0,
        symbol: "In",
        name: "In",
        types: ["http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#AudioPort"],
        kind: "audio",
        direction: "input",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 1,
        symbol: "Out1",
        name: "Out 1",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#OutputPort"],
        kind: "audio",
        direction: "output",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 2,
        symbol: "Tone",
        name: "Tone",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/ext/port-props#logarithmic"],
        kind: "control",
        direction: "input",
        minimum: 0.01,
        maximum: 0.99,
        default: 0.5,
        properties: ["http://lv2plug.in/ns/ext/port-props#logarithmic"]
      },
      {
        index: 3,
        symbol: "Level",
        name: "Level",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/ext/port-props#logarithmic"],
        kind: "control",
        direction: "input",
        minimum: 0.01,
        maximum: 0.99,
        default: 0.5,
        properties: ["http://lv2plug.in/ns/ext/port-props#logarithmic"]
      },
      {
        index: 4,
        symbol: "Dist",
        name: "Dist",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/ext/port-props#logarithmic"],
        kind: "control",
        direction: "input",
        minimum: 0.01,
        maximum: 0.99,
        default: 0.5,
        properties: ["http://lv2plug.in/ns/ext/port-props#logarithmic"]
      }
    ]
  },
  {
    uri: "http://guitarix.sourceforge.net/plugins/gx_sd1sim_#_sd1sim_",
    name: "GxSD1",
    ports: [
      {
        index: 0,
        symbol: "out",
        name: "Out",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#OutputPort"],
        kind: "audio",
        direction: "output",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 1,
        symbol: "in",
        name: "In",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 2,
        symbol: "BYPASS",
        name: "BYPASS",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#enabled","http://lv2plug.in/ns/lv2core#integer"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 1,
        properties: ["http://lv2plug.in/ns/lv2core#integer"]
      },
      {
        index: 3,
        symbol: "DRIVE",
        name: "DRIVE",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0.5,
        properties: []
      },
      {
        index: 4,
        symbol: "LEVEL",
        name: "LEVEL",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: -20,
        maximum: 4,
        default: -16,
        properties: []
      },
      {
        index: 5,
        symbol: "TONE",
        name: "TONE",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 100,
        maximum: 1000,
        default: 400,
        properties: []
      }
    ]
  },
  {
    uri: "http://guitarix.sourceforge.net/plugins/gxts9#ts9sim",
    name: "GxTubeScreamer",
    ports: [
      {
        index: 0,
        symbol: "fslider0_",
        name: "Level",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: -20,
        maximum: 4,
        default: -16,
        properties: []
      },
      {
        index: 1,
        symbol: "fslider1_",
        name: "Tone",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 100,
        maximum: 1000,
        default: 400,
        properties: []
      },
      {
        index: 2,
        symbol: "fslider2_",
        name: "Drive",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0.5,
        properties: []
      },
      {
        index: 3,
        symbol: "out",
        name: "Out",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#OutputPort"],
        kind: "audio",
        direction: "output",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 4,
        symbol: "in",
        name: "in",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      }
    ]
  },
  {
    uri: "https://github.com/jatinchowdhury18/KlonCentaur",
    name: "ChowCentaur",
    ports: [
      {
        index: 0,
        symbol: "lv2_freewheel",
        name: "Freewheel",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#freeWheeling","http://lv2plug.in/ns/ext/port-props#notOnGUI","http://lv2plug.in/ns/lv2core#toggled"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0,
        properties: ["http://lv2plug.in/ns/ext/port-props#notOnGUI","http://lv2plug.in/ns/lv2core#toggled"]
      },
      {
        index: 1,
        symbol: "lv2_audio_in",
        name: "Audio Input",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 2,
        symbol: "lv2_audio_out",
        name: "Audio Output",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#OutputPort"],
        kind: "audio",
        direction: "output",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 3,
        symbol: "gain",
        name: "Gain",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0.5,
        properties: []
      },
      {
        index: 4,
        symbol: "treble",
        name: "Treble",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0.5,
        properties: []
      },
      {
        index: 5,
        symbol: "level",
        name: "Level",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0.5,
        properties: []
      },
      {
        index: 6,
        symbol: "mode",
        name: "Mode",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#enumeration","http://lv2plug.in/ns/lv2core#integer"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0,
        properties: ["http://lv2plug.in/ns/lv2core#enumeration","http://lv2plug.in/ns/lv2core#integer"]
      },
      {
        index: 7,
        symbol: "lv2_enabled",
        name: "Enabled",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#enabled","http://lv2plug.in/ns/lv2core#toggled"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 1,
        properties: ["http://lv2plug.in/ns/lv2core#toggled"]
      },
      {
        index: 8,
        symbol: "mono",
        name: "Mono",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/ext/port-props#notOnGUI","http://lv2plug.in/ns/lv2core#toggled"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 1,
        properties: ["http://lv2plug.in/ns/ext/port-props#notOnGUI","http://lv2plug.in/ns/lv2core#toggled"]
      }
    ]
  },
  {
    uri: "http://moddevices.com/plugins/mod-devel/BigMuffPi",
    name: "Open Big Muff",
    ports: [
      {
        index: 0,
        symbol: "In",
        name: "In",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 1,
        symbol: "Out1",
        name: "Out 1",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#OutputPort"],
        kind: "audio",
        direction: "output",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 2,
        symbol: "Tone",
        name: "Tone",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0.5,
        properties: []
      },
      {
        index: 3,
        symbol: "Level",
        name: "Level",
        types: ["http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#ControlPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0.5,
        properties: []
      },
      {
        index: 4,
        symbol: "Sustain",
        name: "Sustain",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0.5,
        properties: []
      }
    ]
  },
  {
    uri: "https://github.com/brummer10/CollisionDrive",
    name: "CollisionDrive",
    ports: [
      {
        index: 0,
        symbol: "out",
        name: "out",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#OutputPort"],
        kind: "audio",
        direction: "output",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 1,
        symbol: "in",
        name: "in",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 2,
        symbol: "BYPASS",
        name: "bypass",
        types: ["http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#enabled","http://lv2plug.in/ns/lv2core#toggled"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 1,
        properties: ["http://lv2plug.in/ns/lv2core#toggled"]
      },
      {
        index: 3,
        symbol: "BRIGHT",
        name: "bright",
        types: ["http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#ControlPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0.5,
        properties: []
      },
      {
        index: 4,
        symbol: "GATE",
        name: "gate",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: -95,
        maximum: -10,
        default: -55,
        properties: []
      },
      {
        index: 5,
        symbol: "ATTACK",
        name: "attack",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#integer"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 5,
        default: 3,
        properties: ["http://lv2plug.in/ns/lv2core#integer"]
      },
      {
        index: 6,
        symbol: "DRIVE",
        name: "drive",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0.1,
        properties: []
      },
      {
        index: 7,
        symbol: "LEVEL",
        name: "level",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: -20,
        maximum: 4,
        default: -10,
        properties: []
      },
      {
        index: 8,
        symbol: "V1",
        name: "v1",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#OutputPort"],
        kind: "control",
        direction: "output",
        minimum: 0,
        maximum: 1,
        default: 0,
        properties: []
      }
    ]
  },
  {
    uri: "https://github.com/brummer10/MetalTone",
    name: "MetalTone",
    ports: [
      {
        index: 0,
        symbol: "in0",
        name: "In0",
        types: ["http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#AudioPort"],
        kind: "audio",
        direction: "input",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 1,
        symbol: "out0",
        name: "Out0",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#OutputPort"],
        kind: "audio",
        direction: "output",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 2,
        symbol: "Bypass",
        name: "bypass",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#enabled","http://lv2plug.in/ns/lv2core#toggled"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 1,
        properties: ["http://lv2plug.in/ns/lv2core#toggled"]
      },
      {
        index: 3,
        symbol: "DIST",
        name: "dist",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0,
        properties: []
      },
      {
        index: 4,
        symbol: "HIGH",
        name: "high",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0.5,
        properties: []
      },
      {
        index: 5,
        symbol: "LEVEL",
        name: "level",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0.3,
        properties: []
      },
      {
        index: 6,
        symbol: "LOW",
        name: "low",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0.5,
        properties: []
      },
      {
        index: 7,
        symbol: "MIDFREQ",
        name: "midfreq",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0.5,
        properties: []
      },
      {
        index: 8,
        symbol: "MIDDLE",
        name: "middle",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0.5,
        properties: []
      }
    ]
  },
  {
    uri: "http://guitarix.sourceforge.net/plugins/gxbooster#booster",
    name: "GxBooster",
    ports: [
      {
        index: 0,
        symbol: "fslider0_",
        name: "H Level",
        types: ["http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#ControlPort"],
        kind: "control",
        direction: "input",
        minimum: 0.5,
        maximum: 20,
        default: 1,
        properties: []
      },
      {
        index: 1,
        symbol: "fslider1_",
        name: "B Level",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0.5,
        maximum: 20,
        default: 1,
        properties: []
      },
      {
        index: 2,
        symbol: "out",
        name: "Out",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#OutputPort"],
        kind: "audio",
        direction: "output",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 3,
        symbol: "in",
        name: "in",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      }
    ]
  },
  {
    uri: "https://github.com/ninodewit/SHIRO-Plugins/plugins/modulay",
    name: "Modulay",
    ports: [
      {
        index: 0,
        symbol: "lv2_audio_in_1",
        name: "Audio Input 1",
        types: ["http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#AudioPort"],
        kind: "audio",
        direction: "input",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 1,
        symbol: "lv2_audio_out_1",
        name: "Audio Output 1",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#OutputPort"],
        kind: "audio",
        direction: "output",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 2,
        symbol: "repeats",
        name: "repeats",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 110,
        default: 75,
        properties: []
      },
      {
        index: 3,
        symbol: "mix",
        name: "mix",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 75,
        properties: []
      },
      {
        index: 4,
        symbol: "rate",
        name: "rate",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://moddevices.com/ns/mod#tapTempo","http://moddevices.com/ns/mod#tempoRelatedDynamicScalePoints","http://lv2plug.in/ns/ext/port-props#logarithmic"],
        kind: "control",
        direction: "input",
        minimum: 0.1,
        maximum: 5,
        default: 2,
        properties: ["http://moddevices.com/ns/mod#tapTempo","http://moddevices.com/ns/mod#tempoRelatedDynamicScalePoints","http://lv2plug.in/ns/ext/port-props#logarithmic"]
      },
      {
        index: 5,
        symbol: "depth",
        name: "depth",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/ext/port-props#logarithmic"],
        kind: "control",
        direction: "input",
        minimum: 0.1,
        maximum: 3,
        default: 1,
        properties: ["http://lv2plug.in/ns/ext/port-props#logarithmic"]
      },
      {
        index: 6,
        symbol: "time",
        name: "time",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://moddevices.com/ns/mod#tempoRelatedDynamicScalePoints","http://moddevices.com/ns/mod#tapTempo"],
        kind: "control",
        direction: "input",
        minimum: 20,
        maximum: 1000,
        default: 500,
        properties: ["http://moddevices.com/ns/mod#tempoRelatedDynamicScalePoints","http://moddevices.com/ns/mod#tapTempo"]
      },
      {
        index: 7,
        symbol: "morph",
        name: "morph",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 50,
        properties: []
      },
      {
        index: 8,
        symbol: "tone",
        name: "tone",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/ext/port-props#logarithmic"],
        kind: "control",
        direction: "input",
        minimum: 500,
        maximum: 6000,
        default: 3000,
        properties: ["http://lv2plug.in/ns/ext/port-props#logarithmic"]
      }
    ]
  },
  {
    uri: "https://github.com/ninodewit/SHIRO-Plugins/plugins/shiroverb",
    name: "Shiroverb",
    ports: [
      {
        index: 0,
        symbol: "lv2_audio_in_1",
        name: "Audio Input 1",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 1,
        symbol: "lv2_audio_out_1",
        name: "Audio Output 1",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#OutputPort"],
        kind: "audio",
        direction: "output",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 2,
        symbol: "lv2_audio_out_2",
        name: "Audio Output 2",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#OutputPort"],
        kind: "audio",
        direction: "output",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 3,
        symbol: "shimmer",
        name: "shimmer",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 50,
        properties: []
      },
      {
        index: 4,
        symbol: "decay",
        name: "decay",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 1,
        maximum: 100,
        default: 50,
        properties: []
      },
      {
        index: 5,
        symbol: "damping",
        name: "damping",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 50,
        properties: []
      },
      {
        index: 6,
        symbol: "mix",
        name: "mix",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 50,
        properties: []
      },
      {
        index: 7,
        symbol: "ratio",
        name: "ratio",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0.5,
        maximum: 2,
        default: 2,
        properties: []
      },
      {
        index: 8,
        symbol: "roomsize",
        name: "roomsize",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 1,
        maximum: 300,
        default: 150,
        properties: []
      },
      {
        index: 9,
        symbol: "bandwidth",
        name: "bandwidth",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 75,
        properties: []
      },
      {
        index: 10,
        symbol: "tone",
        name: "tone",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/ext/port-props#logarithmic"],
        kind: "control",
        direction: "input",
        minimum: 500,
        maximum: 6000,
        default: 1500,
        properties: ["http://lv2plug.in/ns/ext/port-props#logarithmic"]
      }
    ]
  },
  {
    uri: "http://moddevices.com/plugins/mda/DubDelay",
    name: "MDA DubDelay",
    ports: [
      {
        index: 0,
        symbol: "delay",
        name: "Delay",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://moddevices.com/ns/mod#tapTempo","http://moddevices.com/ns/mod#tempoRelatedDynamicScalePoints","http://lv2plug.in/ns/ext/port-props#logarithmic"],
        kind: "control",
        direction: "input",
        minimum: 1,
        maximum: 7500,
        default: 460,
        properties: ["http://moddevices.com/ns/mod#tapTempo","http://moddevices.com/ns/mod#tempoRelatedDynamicScalePoints","http://lv2plug.in/ns/ext/port-props#logarithmic"]
      },
      {
        index: 1,
        symbol: "feedback",
        name: "Feedback",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: -110,
        maximum: 110,
        default: 55,
        properties: []
      },
      {
        index: 2,
        symbol: "fb_tone",
        name: "Fb Tone",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: -100,
        maximum: 100,
        default: 0,
        properties: []
      },
      {
        index: 3,
        symbol: "lfo_depth",
        name: "LFO Depth",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 30,
        properties: []
      },
      {
        index: 4,
        symbol: "lfo_rate",
        name: "LFO Rate",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://moddevices.com/ns/mod#tapTempo"],
        kind: "control",
        direction: "input",
        minimum: 0.01,
        maximum: 10,
        default: 0.05,
        properties: ["http://moddevices.com/ns/mod#tapTempo"]
      },
      {
        index: 5,
        symbol: "fx_mix",
        name: "FX Mix",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 50,
        properties: []
      },
      {
        index: 6,
        symbol: "output",
        name: "Level",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: -12,
        maximum: 6,
        default: 0,
        properties: []
      },
      {
        index: 7,
        symbol: "left_in",
        name: "Left In",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/ext/port-groups#left"],
        kind: "audio",
        direction: "input",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 8,
        symbol: "right_in",
        name: "Right In",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/ext/port-groups#right"],
        kind: "audio",
        direction: "input",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 9,
        symbol: "left_out",
        name: "Left Out",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#OutputPort","http://lv2plug.in/ns/ext/port-groups#left"],
        kind: "audio",
        direction: "output",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 10,
        symbol: "right_out",
        name: "Right Out",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#OutputPort","http://lv2plug.in/ns/ext/port-groups#right"],
        kind: "audio",
        direction: "output",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      }
    ]
  },
  {
    uri: "http://moddevices.com/plugins/tap/echo",
    name: "TAP Stereo Echo",
    ports: [
      {
        index: 0,
        symbol: "ldelay",
        name: "L Delay",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://moddevices.com/ns/mod#tapTempo","http://moddevices.com/ns/mod#tempoRelatedDynamicScalePoints"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 2000,
        default: 300,
        properties: ["http://moddevices.com/ns/mod#tapTempo","http://moddevices.com/ns/mod#tempoRelatedDynamicScalePoints"]
      },
      {
        index: 1,
        symbol: "lfeedback",
        name: "Left Feedback",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 50,
        properties: []
      },
      {
        index: 2,
        symbol: "rhaasdelay",
        name: "Right Haas Delay",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://moddevices.com/ns/mod#tempoRelatedDynamicScalePoints","http://moddevices.com/ns/mod#tapTempo"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 2000,
        default: 300,
        properties: ["http://moddevices.com/ns/mod#tempoRelatedDynamicScalePoints","http://moddevices.com/ns/mod#tapTempo"]
      },
      {
        index: 3,
        symbol: "rhaasfeedback",
        name: "Right Haas Feedback",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 50,
        properties: []
      },
      {
        index: 4,
        symbol: "lecholevel",
        name: "Left Echo Level",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: -70,
        maximum: 10,
        default: -4,
        properties: []
      },
      {
        index: 5,
        symbol: "recholevel",
        name: "Right Echo Level",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: -70,
        maximum: 10,
        default: -4,
        properties: []
      },
      {
        index: 6,
        symbol: "dryLevel",
        name: "Dry Level",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: -70,
        maximum: 10,
        default: -4,
        properties: []
      },
      {
        index: 7,
        symbol: "crossmode",
        name: "Cross Mode",
        types: ["http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#toggled"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 1,
        properties: ["http://lv2plug.in/ns/lv2core#toggled"]
      },
      {
        index: 8,
        symbol: "haaseffect",
        name: "Haas Effect",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#toggled"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0,
        properties: ["http://lv2plug.in/ns/lv2core#toggled"]
      },
      {
        index: 9,
        symbol: "swapoutputs",
        name: "Swap Outputs",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#toggled"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0,
        properties: ["http://lv2plug.in/ns/lv2core#toggled"]
      },
      {
        index: 10,
        symbol: "inputleft",
        name: "Input Left",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 11,
        symbol: "outputleft",
        name: "Output Left",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#OutputPort"],
        kind: "audio",
        direction: "output",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 12,
        symbol: "inputright",
        name: "Input Right",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 13,
        symbol: "outputright",
        name: "Output Right",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#OutputPort"],
        kind: "audio",
        direction: "output",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      }
    ]
  },
  {
    uri: "http://distrho.sf.net/plugins/PingPongPan",
    name: "Ping Pong Pan",
    ports: [
      {
        index: 0,
        symbol: "lv2_audio_in_1",
        name: "Audio Input 1",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 1,
        symbol: "lv2_audio_in_2",
        name: "Audio Input 2",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 2,
        symbol: "lv2_audio_out_1",
        name: "Audio Output 1",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#OutputPort"],
        kind: "audio",
        direction: "output",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 3,
        symbol: "lv2_audio_out_2",
        name: "Audio Output 2",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#OutputPort"],
        kind: "audio",
        direction: "output",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 4,
        symbol: "freq",
        name: "Frequency",
        types: ["http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#ControlPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 50,
        properties: []
      },
      {
        index: 5,
        symbol: "width",
        name: "Width",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 75,
        properties: []
      }
    ]
  },
  {
    uri: "http://moddevices.com/plugins/tal-reverb-2",
    name: "TAL-Reverb-II",
    ports: [
      {
        index: 0,
        symbol: "lv2_freewheel",
        name: "Freewheel",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#freeWheeling","http://lv2plug.in/ns/lv2core#toggled","http://lv2plug.in/ns/ext/port-props#notOnGUI"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0,
        properties: ["http://lv2plug.in/ns/lv2core#toggled","http://lv2plug.in/ns/ext/port-props#notOnGUI"]
      },
      {
        index: 1,
        symbol: "lv2_audio_in_1",
        name: "Audio Input 1",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 2,
        symbol: "lv2_audio_in_2",
        name: "Audio Input 2",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 3,
        symbol: "lv2_audio_out_1",
        name: "Audio Output 1",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#OutputPort"],
        kind: "audio",
        direction: "output",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 4,
        symbol: "lv2_audio_out_2",
        name: "Audio Output 2",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#OutputPort"],
        kind: "audio",
        direction: "output",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 5,
        symbol: "dry",
        name: "dry",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: -96,
        maximum: 26.4,
        default: 0,
        properties: []
      },
      {
        index: 6,
        symbol: "wet",
        name: "wet",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: -96,
        maximum: 26.4,
        default: -24.1,
        properties: []
      },
      {
        index: 7,
        symbol: "room_size",
        name: "room size",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0.752,
        properties: []
      },
      {
        index: 8,
        symbol: "pre_delay",
        name: "pre delay",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1000,
        default: 37,
        properties: []
      },
      {
        index: 9,
        symbol: "low_shelf_frequency",
        name: "low frequency",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/ext/port-props#logarithmic"],
        kind: "control",
        direction: "input",
        minimum: 100,
        maximum: 10000,
        default: 257,
        properties: ["http://lv2plug.in/ns/ext/port-props#logarithmic"]
      },
      {
        index: 10,
        symbol: "high_shelf_frequency",
        name: "high frequency",
        types: ["http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/ext/port-props#logarithmic"],
        kind: "control",
        direction: "input",
        minimum: 100,
        maximum: 10000,
        default: 3039,
        properties: ["http://lv2plug.in/ns/ext/port-props#logarithmic"]
      },
      {
        index: 11,
        symbol: "peak_frequency",
        name: "mid frequency",
        types: ["http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/ext/port-props#logarithmic"],
        kind: "control",
        direction: "input",
        minimum: 100,
        maximum: 10000,
        default: 2237,
        properties: ["http://lv2plug.in/ns/ext/port-props#logarithmic"]
      },
      {
        index: 12,
        symbol: "low_shelf_gain",
        name: "low gain",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: -18,
        maximum: 0,
        default: -0.4,
        properties: []
      },
      {
        index: 13,
        symbol: "high_shelf_gain",
        name: "high gain",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: -18,
        maximum: 0,
        default: -1.2,
        properties: []
      },
      {
        index: 14,
        symbol: "peak_gain",
        name: "mid gain",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: -18,
        maximum: 0,
        default: -1.7,
        properties: []
      },
      {
        index: 15,
        symbol: "stereo_width",
        name: "stereo width",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 1,
        properties: []
      },
      {
        index: 16,
        symbol: "stereo_input",
        name: "stereo input",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#toggled"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0,
        properties: ["http://lv2plug.in/ns/lv2core#toggled"]
      }
    ]
  },
  {
    uri: "urn:dragonfly:room",
    name: "Dragonfly Room Reverb",
    ports: [
      {
        index: 0,
        symbol: "lv2_audio_in_1",
        name: "Audio Input 1",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 1,
        symbol: "lv2_audio_in_2",
        name: "Audio Input 2",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 2,
        symbol: "lv2_audio_out_1",
        name: "Audio Output 1",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#OutputPort"],
        kind: "audio",
        direction: "output",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 3,
        symbol: "lv2_audio_out_2",
        name: "Audio Output 2",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#OutputPort"],
        kind: "audio",
        direction: "output",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 4,
        symbol: "lv2_events_in",
        name: "Events Input",
        types: ["http://lv2plug.in/ns/ext/atom#AtomPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "atom",
        direction: "input",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 5,
        symbol: "lv2_events_out",
        name: "Events Output",
        types: ["http://lv2plug.in/ns/ext/atom#AtomPort","http://lv2plug.in/ns/lv2core#OutputPort"],
        kind: "atom",
        direction: "output",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 6,
        symbol: "dry_level",
        name: "Dry Level",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
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
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 10,
        properties: []
      },
      {
        index: 8,
        symbol: "early_send",
        name: "Early Send",
        types: ["http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#ControlPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 20,
        properties: []
      },
      {
        index: 9,
        symbol: "late_level",
        name: "Late Level",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 20,
        properties: []
      },
      {
        index: 10,
        symbol: "size",
        name: "Size",
        types: ["http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#ControlPort"],
        kind: "control",
        direction: "input",
        minimum: 8,
        maximum: 32,
        default: 12,
        properties: []
      },
      {
        index: 11,
        symbol: "width",
        name: "Width",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 50,
        maximum: 150,
        default: 100,
        properties: []
      },
      {
        index: 12,
        symbol: "predelay",
        name: "Predelay",
        types: ["http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#ControlPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 8,
        properties: []
      },
      {
        index: 13,
        symbol: "decay",
        name: "Decay",
        types: ["http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#ControlPort"],
        kind: "control",
        direction: "input",
        minimum: 0.1,
        maximum: 10,
        default: 0.4,
        properties: []
      },
      {
        index: 14,
        symbol: "diffuse",
        name: "Diffuse",
        types: ["http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#ControlPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 70,
        properties: []
      },
      {
        index: 15,
        symbol: "spin",
        name: "Spin",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 5,
        default: 0.8,
        properties: []
      },
      {
        index: 16,
        symbol: "wander",
        name: "Wander",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 40,
        properties: []
      },
      {
        index: 17,
        symbol: "in_high_cut",
        name: "High Cut",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 1000,
        maximum: 16000,
        default: 16000,
        properties: []
      },
      {
        index: 18,
        symbol: "early_damp",
        name: "Early Damp",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 1000,
        maximum: 16000,
        default: 10000,
        properties: []
      },
      {
        index: 19,
        symbol: "late_damp",
        name: "Late Damp",
        types: ["http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#ControlPort"],
        kind: "control",
        direction: "input",
        minimum: 1000,
        maximum: 16000,
        default: 9400,
        properties: []
      },
      {
        index: 20,
        symbol: "low_boost",
        name: "Low Boost",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 50,
        properties: []
      },
      {
        index: 21,
        symbol: "boost_freq",
        name: "Boost Freq",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 50,
        maximum: 1050,
        default: 600,
        properties: []
      },
      {
        index: 22,
        symbol: "in_low_cut",
        name: "Low Cut",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 200,
        default: 4,
        properties: []
      }
    ]
  },
  {
    uri: "urn:dragonfly:plate",
    name: "Dragonfly Plate Reverb",
    ports: [
      {
        index: 0,
        symbol: "lv2_audio_in_1",
        name: "Audio Input 1",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 1,
        symbol: "lv2_audio_in_2",
        name: "Audio Input 2",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 2,
        symbol: "lv2_audio_out_1",
        name: "Audio Output 1",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#OutputPort"],
        kind: "audio",
        direction: "output",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 3,
        symbol: "lv2_audio_out_2",
        name: "Audio Output 2",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#OutputPort"],
        kind: "audio",
        direction: "output",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 4,
        symbol: "lv2_events_in",
        name: "Events Input",
        types: ["http://lv2plug.in/ns/ext/atom#AtomPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "atom",
        direction: "input",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 5,
        symbol: "lv2_events_out",
        name: "Events Output",
        types: ["http://lv2plug.in/ns/ext/atom#AtomPort","http://lv2plug.in/ns/lv2core#OutputPort"],
        kind: "atom",
        direction: "output",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 6,
        symbol: "dry_level",
        name: "Dry Level",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
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
        name: "Wet Level",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 20,
        properties: []
      },
      {
        index: 8,
        symbol: "algorithm",
        name: "Algorithm",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#enumeration","http://lv2plug.in/ns/lv2core#integer"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 2,
        default: 1,
        properties: ["http://lv2plug.in/ns/lv2core#enumeration","http://lv2plug.in/ns/lv2core#integer"]
      },
      {
        index: 9,
        symbol: "width",
        name: "Width",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 50,
        maximum: 150,
        default: 100,
        properties: []
      },
      {
        index: 10,
        symbol: "predelay",
        name: "Predelay",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 100,
        default: 0,
        properties: []
      },
      {
        index: 11,
        symbol: "decay",
        name: "Decay",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0.1,
        maximum: 10,
        default: 0.4,
        properties: []
      },
      {
        index: 12,
        symbol: "low_cut",
        name: "Low Cut",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 200,
        default: 200,
        properties: []
      },
      {
        index: 13,
        symbol: "high_cut",
        name: "High Cut",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 1000,
        maximum: 16000,
        default: 16000,
        properties: []
      },
      {
        index: 14,
        symbol: "early_damp",
        name: "Dampen",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 1000,
        maximum: 16000,
        default: 13000,
        properties: []
      }
    ]
  },
  {
    uri: "http://guitarix.sourceforge.net/plugins/gx_compressor#_compressor",
    name: "GxCompressor",
    ports: [
      {
        index: 0,
        symbol: "RATIO",
        name: "RATIO",
        types: ["http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#ControlPort"],
        kind: "control",
        direction: "input",
        minimum: 1,
        maximum: 20,
        default: 2,
        properties: []
      },
      {
        index: 1,
        symbol: "KNEE",
        name: "KNEE",
        types: ["http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#ControlPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 20,
        default: 3,
        properties: []
      },
      {
        index: 2,
        symbol: "THRESHOLD",
        name: "THRESHOLD",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: -96,
        maximum: 10,
        default: -20,
        properties: []
      },
      {
        index: 3,
        symbol: "RELEASE",
        name: "RELEASE",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 10,
        default: 0.5,
        properties: []
      },
      {
        index: 4,
        symbol: "ATTACK",
        name: "ATTACK",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0.002,
        properties: []
      },
      {
        index: 5,
        symbol: "out",
        name: "Out",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#OutputPort"],
        kind: "audio",
        direction: "output",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 6,
        symbol: "in",
        name: "In",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      }
    ]
  },
  {
    uri: "http://moddevices.com/plugins/mod-devel/System-NoiseGate",
    name: "Noise Gate",
    ports: [
      {
        index: 0,
        symbol: "Input_1",
        name: "Input 1",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 1,
        symbol: "Input_2",
        name: "Input 2",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 2,
        symbol: "Output_1",
        name: "Output 1",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#OutputPort"],
        kind: "audio",
        direction: "output",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 3,
        symbol: "Output_2",
        name: "Output 2",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#OutputPort"],
        kind: "audio",
        direction: "output",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 4,
        symbol: "Gate_Mode",
        name: "Gate Mode",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#enumeration","http://lv2plug.in/ns/lv2core#integer"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 4,
        default: 3,
        properties: ["http://lv2plug.in/ns/lv2core#enumeration","http://lv2plug.in/ns/lv2core#integer"]
      },
      {
        index: 5,
        symbol: "Threshold",
        name: "Threshold",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: -70,
        maximum: -10,
        default: -60,
        properties: []
      },
      {
        index: 6,
        symbol: "Decay",
        name: "Decay",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 1,
        maximum: 500,
        default: 10,
        properties: []
      }
    ]
  },
  {
    uri: "http://moddevices.com/plugins/mod-devel/mod-volume",
    name: "Volume",
    ports: [
      {
        index: 0,
        symbol: "AudioIn",
        name: "Audio In",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 1,
        symbol: "AudioOut",
        name: "Audio Out",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#OutputPort"],
        kind: "audio",
        direction: "output",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 2,
        symbol: "Mode",
        name: "Mode",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#integer","http://lv2plug.in/ns/lv2core#enumeration"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0,
        properties: ["http://lv2plug.in/ns/lv2core#integer","http://lv2plug.in/ns/lv2core#enumeration"]
      },
      {
        index: 3,
        symbol: "Volume",
        name: "Volume",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 1,
        properties: []
      },
      {
        index: 4,
        symbol: "PluginEnabled",
        name: "PluginEnabled",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#enabled","http://lv2plug.in/ns/lv2core#toggled"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 1,
        properties: ["http://lv2plug.in/ns/lv2core#toggled"]
      }
    ]
  },
  {
    uri: "urn:mod:gxtuner",
    name: "GxTuner",
    ports: [
      {
        index: 0,
        symbol: "FREQ",
        name: "FREQ",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#OutputPort"],
        kind: "control",
        direction: "output",
        minimum: 0,
        maximum: 1000,
        default: 0,
        properties: []
      },
      {
        index: 1,
        symbol: "REFFREQ",
        name: "REFFREQ",
        types: ["http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#ControlPort"],
        kind: "control",
        direction: "input",
        minimum: 427,
        maximum: 453,
        default: 440,
        properties: []
      },
      {
        index: 2,
        symbol: "TUNER_MODE",
        name: "Tuner Mode",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#enumeration","http://lv2plug.in/ns/lv2core#integer"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 54,
        default: 0,
        properties: ["http://lv2plug.in/ns/lv2core#enumeration","http://lv2plug.in/ns/lv2core#integer"]
      },
      {
        index: 3,
        symbol: "TEMPERAMENT",
        name: "TEMPERAMENT",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 4,
        default: 0,
        properties: []
      },
      {
        index: 4,
        symbol: "THRESHOLD",
        name: "THRESHOLD",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: -60,
        maximum: 4,
        default: -50,
        properties: []
      },
      {
        index: 5,
        symbol: "MAXL",
        name: "MAXL",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#OutputPort"],
        kind: "control",
        direction: "output",
        minimum: 0,
        maximum: 1000,
        default: 0,
        properties: []
      },
      {
        index: 6,
        symbol: "RESET",
        name: "RESET",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: -10,
        maximum: 10,
        default: 1,
        properties: []
      },
      {
        index: 7,
        symbol: "LEVEL",
        name: "LEVEL",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: -60,
        maximum: 4,
        default: -45,
        properties: []
      },
      {
        index: 8,
        symbol: "CHANNEL",
        name: "CHANNELL",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#enumeration","http://lv2plug.in/ns/lv2core#integer"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 16,
        default: 0,
        properties: ["http://lv2plug.in/ns/lv2core#enumeration","http://lv2plug.in/ns/lv2core#integer"]
      },
      {
        index: 9,
        symbol: "MIDI_ON",
        name: "MIDI_ON",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#integer"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0,
        properties: ["http://lv2plug.in/ns/lv2core#integer"]
      },
      {
        index: 10,
        symbol: "FASTNOTE",
        name: "FASTNOTE",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#integer"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0,
        properties: ["http://lv2plug.in/ns/lv2core#integer"]
      },
      {
        index: 11,
        symbol: "PITCHBEND",
        name: "PITCHBEND",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#integer"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0,
        properties: ["http://lv2plug.in/ns/lv2core#integer"]
      },
      {
        index: 12,
        symbol: "SINGLENOTE",
        name: "SINGLENOTE",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#integer"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0,
        properties: ["http://lv2plug.in/ns/lv2core#integer"]
      },
      {
        index: 13,
        symbol: "BPM",
        name: "BPM",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#integer"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 360,
        default: 0,
        properties: ["http://lv2plug.in/ns/lv2core#integer"]
      },
      {
        index: 14,
        symbol: "VELOCITY",
        name: "VELOCITY",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#integer"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 127,
        default: 64,
        properties: ["http://lv2plug.in/ns/lv2core#integer"]
      },
      {
        index: 15,
        symbol: "VERIFY",
        name: "VERIFY",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#integer"],
        kind: "control",
        direction: "input",
        minimum: 1,
        maximum: 12,
        default: 1,
        properties: ["http://lv2plug.in/ns/lv2core#integer"]
      },
      {
        index: 16,
        symbol: "GATE",
        name: "GATE",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#integer"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0,
        properties: ["http://lv2plug.in/ns/lv2core#integer"]
      },
      {
        index: 17,
        symbol: "SYNTHFREQ",
        name: "SYNTHFREQ",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 30,
        maximum: 1000,
        default: 220,
        properties: []
      },
      {
        index: 18,
        symbol: "GAIN",
        name: "GAIN",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 1,
        properties: []
      },
      {
        index: 19,
        symbol: "midi_out",
        name: "MIDI Out",
        types: ["http://lv2plug.in/ns/ext/atom#AtomPort","http://lv2plug.in/ns/lv2core#OutputPort","http://lv2plug.in/ns/lv2core#control"],
        kind: "atom",
        direction: "output",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 20,
        symbol: "out",
        name: "Out",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#OutputPort"],
        kind: "audio",
        direction: "output",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 21,
        symbol: "in",
        name: "In",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      }
    ]
  },
  {
    uri: "http://gareus.org/oss/lv2/fat1",
    name: "Autotune",
    ports: [
      {
        index: 0,
        symbol: "midiin",
        name: "MIDI In",
        types: ["http://lv2plug.in/ns/ext/atom#AtomPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#isSideChain"],
        kind: "atom",
        direction: "input",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: ["http://lv2plug.in/ns/lv2core#isSideChain"]
      },
      {
        index: 1,
        symbol: "in",
        name: "Input",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 2,
        symbol: "out",
        name: "Output",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#OutputPort"],
        kind: "audio",
        direction: "output",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 3,
        symbol: "mode",
        name: "Mode",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#integer","http://lv2plug.in/ns/lv2core#enumeration"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 2,
        default: 0,
        properties: ["http://lv2plug.in/ns/lv2core#integer","http://lv2plug.in/ns/lv2core#enumeration"]
      },
      {
        index: 4,
        symbol: "channelf",
        name: "Filter Channel",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#integer","http://lv2plug.in/ns/lv2core#enumeration"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 16,
        default: 0,
        properties: ["http://lv2plug.in/ns/lv2core#integer","http://lv2plug.in/ns/lv2core#enumeration"]
      },
      {
        index: 5,
        symbol: "tuning",
        name: "Tuning",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 400,
        maximum: 480,
        default: 440,
        properties: []
      },
      {
        index: 6,
        symbol: "bias",
        name: "Bias",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0.5,
        properties: []
      },
      {
        index: 7,
        symbol: "filter",
        name: "Filter",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/ext/port-props#logarithmic"],
        kind: "control",
        direction: "input",
        minimum: 0.02,
        maximum: 0.5,
        default: 0.1,
        properties: ["http://lv2plug.in/ns/ext/port-props#logarithmic"]
      },
      {
        index: 8,
        symbol: "corr",
        name: "Correction",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 1,
        properties: []
      },
      {
        index: 9,
        symbol: "offset",
        name: "Offset",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: -2,
        maximum: 2,
        default: 0,
        properties: []
      },
      {
        index: 10,
        symbol: "m00",
        name: "C",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#integer","http://lv2plug.in/ns/lv2core#toggled"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 1,
        properties: ["http://lv2plug.in/ns/lv2core#integer","http://lv2plug.in/ns/lv2core#toggled"]
      },
      {
        index: 11,
        symbol: "m01",
        name: "C#",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#integer","http://lv2plug.in/ns/lv2core#toggled"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 1,
        properties: ["http://lv2plug.in/ns/lv2core#integer","http://lv2plug.in/ns/lv2core#toggled"]
      },
      {
        index: 12,
        symbol: "m02",
        name: "D",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#integer","http://lv2plug.in/ns/lv2core#toggled"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 1,
        properties: ["http://lv2plug.in/ns/lv2core#integer","http://lv2plug.in/ns/lv2core#toggled"]
      },
      {
        index: 13,
        symbol: "m03",
        name: "D#",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#integer","http://lv2plug.in/ns/lv2core#toggled"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 1,
        properties: ["http://lv2plug.in/ns/lv2core#integer","http://lv2plug.in/ns/lv2core#toggled"]
      },
      {
        index: 14,
        symbol: "m04",
        name: "E",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#integer","http://lv2plug.in/ns/lv2core#toggled"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 1,
        properties: ["http://lv2plug.in/ns/lv2core#integer","http://lv2plug.in/ns/lv2core#toggled"]
      },
      {
        index: 15,
        symbol: "m05",
        name: "F",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#integer","http://lv2plug.in/ns/lv2core#toggled"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 1,
        properties: ["http://lv2plug.in/ns/lv2core#integer","http://lv2plug.in/ns/lv2core#toggled"]
      },
      {
        index: 16,
        symbol: "m06",
        name: "F#",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#integer","http://lv2plug.in/ns/lv2core#toggled"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 1,
        properties: ["http://lv2plug.in/ns/lv2core#integer","http://lv2plug.in/ns/lv2core#toggled"]
      },
      {
        index: 17,
        symbol: "m07",
        name: "G",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#integer","http://lv2plug.in/ns/lv2core#toggled"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 1,
        properties: ["http://lv2plug.in/ns/lv2core#integer","http://lv2plug.in/ns/lv2core#toggled"]
      },
      {
        index: 18,
        symbol: "m08",
        name: "G#",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#integer","http://lv2plug.in/ns/lv2core#toggled"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 1,
        properties: ["http://lv2plug.in/ns/lv2core#integer","http://lv2plug.in/ns/lv2core#toggled"]
      },
      {
        index: 19,
        symbol: "m09",
        name: "A",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#integer","http://lv2plug.in/ns/lv2core#toggled"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 1,
        properties: ["http://lv2plug.in/ns/lv2core#integer","http://lv2plug.in/ns/lv2core#toggled"]
      },
      {
        index: 20,
        symbol: "m10",
        name: "A#",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#integer","http://lv2plug.in/ns/lv2core#toggled"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 1,
        properties: ["http://lv2plug.in/ns/lv2core#integer","http://lv2plug.in/ns/lv2core#toggled"]
      },
      {
        index: 21,
        symbol: "m11",
        name: "B",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#integer","http://lv2plug.in/ns/lv2core#toggled"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 1,
        properties: ["http://lv2plug.in/ns/lv2core#integer","http://lv2plug.in/ns/lv2core#toggled"]
      },
      {
        index: 22,
        symbol: "panic",
        name: "MIDI Panic",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/ext/port-props#trigger","http://lv2plug.in/ns/lv2core#integer","http://lv2plug.in/ns/lv2core#toggled"],
        kind: "control",
        direction: "input",
        minimum: 0,
        maximum: 1,
        default: 0,
        properties: ["http://lv2plug.in/ns/ext/port-props#trigger","http://lv2plug.in/ns/lv2core#integer","http://lv2plug.in/ns/lv2core#toggled"]
      },
      {
        index: 23,
        symbol: "nmask",
        name: "Note Mask",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#OutputPort","http://lv2plug.in/ns/lv2core#integer"],
        kind: "control",
        direction: "output",
        minimum: 0,
        maximum: 4096,
        default: 0,
        properties: ["http://lv2plug.in/ns/lv2core#integer"]
      },
      {
        index: 24,
        symbol: "nset",
        name: "Note Set",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#OutputPort","http://lv2plug.in/ns/lv2core#integer"],
        kind: "control",
        direction: "output",
        minimum: 0,
        maximum: 4096,
        default: 0,
        properties: ["http://lv2plug.in/ns/lv2core#integer"]
      },
      {
        index: 25,
        symbol: "error",
        name: "Pitch Error",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#OutputPort"],
        kind: "control",
        direction: "output",
        minimum: -1,
        maximum: 1,
        default: 0,
        properties: []
      },
      {
        index: 26,
        symbol: "latency",
        name: "latency",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#OutputPort","http://lv2plug.in/ns/lv2core#reportsLatency","http://lv2plug.in/ns/lv2core#integer"],
        kind: "control",
        direction: "output",
        minimum: 0,
        maximum: 4096,
        default: 0,
        properties: ["http://lv2plug.in/ns/lv2core#reportsLatency","http://lv2plug.in/ns/lv2core#integer"]
      }
    ]
  },
  {
    uri: "http://moddevices.com/plugins/tap/tubewarmth",
    name: "TAP Tubewarmth",
    ports: [
      {
        index: 0,
        symbol: "drive",
        name: "Drive",
        types: ["http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#ControlPort"],
        kind: "control",
        direction: "input",
        minimum: 0.1,
        maximum: 10,
        default: 5,
        properties: []
      },
      {
        index: 1,
        symbol: "blend",
        name: "Tape--Tube Blend",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: -10,
        maximum: 10,
        default: 10,
        properties: []
      },
      {
        index: 2,
        symbol: "input",
        name: "Input",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 3,
        symbol: "output",
        name: "Output",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#OutputPort"],
        kind: "audio",
        direction: "output",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      }
    ]
  },
  {
    uri: "http://moddevices.com/plugins/tap/sigmoid",
    name: "TAP Sigmoid Booster",
    ports: [
      {
        index: 0,
        symbol: "Pregain",
        name: "Pregain",
        types: ["http://lv2plug.in/ns/lv2core#InputPort","http://lv2plug.in/ns/lv2core#ControlPort"],
        kind: "control",
        direction: "input",
        minimum: -12,
        maximum: 20,
        default: 0,
        properties: []
      },
      {
        index: 1,
        symbol: "Postgain",
        name: "Postgain",
        types: ["http://lv2plug.in/ns/lv2core#ControlPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "control",
        direction: "input",
        minimum: -12,
        maximum: 20,
        default: 0,
        properties: []
      },
      {
        index: 2,
        symbol: "Input",
        name: "Input",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#InputPort"],
        kind: "audio",
        direction: "input",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      },
      {
        index: 3,
        symbol: "Output",
        name: "Output",
        types: ["http://lv2plug.in/ns/lv2core#AudioPort","http://lv2plug.in/ns/lv2core#OutputPort"],
        kind: "audio",
        direction: "output",
        minimum: 0,
        maximum: 0,
        default: 0,
        properties: []
      }
    ]
  }
] as PluginCatalogEntry[];
