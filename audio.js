export class AudioManager {
    constructor() {
        this.ctx = null;
        this.buffers = {};
    }

    async init() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        const sounds = {
            jump: 'jump.mp3',
            score: 'score.mp3',
            die: 'die.mp3'
        };

        for (const [name, url] of Object.entries(sounds)) {
            try {
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                this.buffers[name] = await this.ctx.decodeAudioData(arrayBuffer);
            } catch (e) {
                console.error(`Failed to load sound: ${name}`, e);
            }
        }
    }

    playSound(name) {
        if (this.buffers[name] && this.ctx) {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            const source = this.ctx.createBufferSource();
            source.buffer = this.buffers[name];
            source.connect(this.ctx.destination);
            source.start(0);
        }
    }
}