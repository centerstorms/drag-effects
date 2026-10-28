// Effect registry.
//
// To add an effect:
//   1. Create effects/<id>.js (see _template.js).
//   2. Import it and add the class to EFFECTS below.
//   3. Add its keys to schemas/*.gschema.xml, including
//      effect-<id>-enabled.
//   4. Run ./install.sh and reload GNOME Shell.
//
// extension.js and prefs.js do not need changes: the Preferences UI is
// generated from each effect's static controls.

import {TiltEffect} from './tilt.js';
import {StretchEffect} from './stretch.js';
import {LiftEffect} from './lift.js';
import {OpacityEffect} from './opacity.js';

// --- Set 2: motion ---
import {Tilt3DEffect} from './tilt3d.js';
import {SpeedZoomEffect} from './speed-zoom.js';
import {SquashEffect} from './squash.js';
import {ShakeEffect} from './shake.js';
import {SpringEffect} from './spring.js';
import {PulseEffect} from './pulse.js';
import {AccelTiltEffect} from './accel-tilt.js';
import {WobbleEffect} from './wobble.js';
import {SwingEffect} from './swing.js';
import {JellyEffect} from './jelly.js';
import {FadeSpeedEffect} from './fade-speed.js';

// --- Set 3: material ---
import {DesaturateEffect} from './desaturate.js';
import {TintEffect} from './tint.js';
import {GhostEffect} from './ghost.js';
import {TrailEffect} from './trail.js';

// Array order is also the order shown in Preferences.
export const EFFECTS = [
    TiltEffect,
    StretchEffect,
    LiftEffect,
    OpacityEffect,
    Tilt3DEffect,
    SpeedZoomEffect,
    SquashEffect,
    ShakeEffect,
    SpringEffect,
    PulseEffect,
    AccelTiltEffect,
    WobbleEffect,
    SwingEffect,
    JellyEffect,
    FadeSpeedEffect,
    DesaturateEffect,
    TintEffect,
    GhostEffect,
    TrailEffect,
];
