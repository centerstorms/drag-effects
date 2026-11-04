// "Frame" is the transform result of a single frame.
// Every enabled effect writes into it; the engine merges the values and
// applies them to the window actor.
//
// Conventions:
//   rotationZ : accumulated (degrees)
//   scaleX/Y  : multiplicative (1 = unchanged)
//   opacity   : 0..255, effects take the minimum value
//
// New effects can contribute additional properties if the engine is
// extended accordingly.

export class Frame {
    constructor() {
        this.reset();
    }

    reset() {
        this.rotationX = 0;
        this.rotationY = 0;
        this.rotationZ = 0;
        this.scaleX = 1;
        this.scaleY = 1;
        this.opacity = 255;
    }
}
