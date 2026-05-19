@component()
export class CombinedGameController extends APJS.BasicScriptComponent {

    // ==========================================
    // --- Club Tunable Parameters ---
    // ==========================================

    @serializeProperty
    public oscillationSpeed: number = 120;

    @serializeProperty
    public Do_it: boolean = false;

    @serializeProperty
    public returnSpeed: number = 600;

    @serializeProperty
    public minAngle: number = 2.83;

    @serializeProperty
    public maxAngle: number = 275;

    // ==========================================
    // --- VS Bridge --- Winner Output
    // ==========================================

    @serializeProperty
    public winnerIndex: number = -1;

    @serializeProperty
    public isWinnerReady: boolean = false;

    // ==========================================
    // --- Game Tunable Parameters ---
    // ==========================================

    @serializeProperty
    public velocityMultiplier: number = 5.0;

    @serializeProperty
    public cameraFollowSpeed: number = 3.0;

    @serializeProperty
    public cameraZoomOutScale: number = 1.5;

    @serializeProperty
    public plankHideDelay: number = 7.0;

    @serializeProperty
    public velocityThreshold: number = 5.0;

    // ==========================================
    // --- Scene Object References ---
    // ==========================================

    @serializeProperty
    ballObject!: APJS.SceneObject;

    @serializeProperty
    longPlank1Object!: APJS.SceneObject;

    @serializeProperty
    golfBatObject!: APJS.SceneObject;

    @serializeProperty
    cameraObject!: APJS.SceneObject;

    @serializeProperty
    hitSoundPlayer!: APJS.SceneObject;

    // ==========================================
    // --- Rides Images References ---
    // ==========================================

    @serializeProperty
    bus!: APJS.SceneObject;

    @serializeProperty
    lambo!: APJS.SceneObject;

    @serializeProperty
    donkey!: APJS.SceneObject;

    @serializeProperty
    bullet!: APJS.SceneObject;

    @serializeProperty
    jeep!: APJS.SceneObject;

    @serializeProperty
    chappal!: APJS.SceneObject;

    @serializeProperty
    rustedCar!: APJS.SceneObject;

    @serializeProperty
    scooter!: APJS.SceneObject;

    @serializeProperty
    rols!: APJS.SceneObject;

    @serializeProperty
    car4x4!: APJS.SceneObject;

    @serializeProperty
    toyCar!: APJS.SceneObject;

    @serializeProperty
    truck!: APJS.SceneObject;

    @serializeProperty
    auto!: APJS.SceneObject;

    @serializeProperty
    cycle!: APJS.SceneObject;

    @serializeProperty
    ericksha!: APJS.SceneObject;

    // ==========================================
    // --- State Management ---
    // ==========================================

    private isPlaying: boolean = false;
    private isBallHit: boolean = false;
    private plankTimer: number = 0;
    private isFollowingBall: boolean = false;
    private resultShown: boolean = false;
    private initialized: boolean = false;
    private plankHidden: boolean = false;

    // Club Specific State
    private currentAngle: number = 2.83;
    private isHolding: boolean = false;
    private isReleasing: boolean = false;
    private oscillationDirection: number = 1;
    private releaseAngle: number = 2.83;

    // ==========================================
    // --- Component References ---
    // ==========================================

    private ballRigidBody: APJS.RigidBody2D | null = null;
    private ballTransform: APJS.Transform | null = null;
    private cameraTransform: APJS.Transform | null = null;
    private clubTransform: APJS.Transform | null = null;
    private hitAudio: APJS.AudioComponent | null = null;
    private hitAudioInitialized: boolean = false;

    // ==========================================
    // --- X Boundaries for vehicle detection ---
    // ==========================================

    private vehicleRanges: number[][] = [
        [-175, 90],
        [90, 355],
        [355, 620],
        [620, 885],
        [885, 1150],
        [1150, 1415],
        [1415, 1680],
        [1680, 1945],
        [1945, 2210],
        [2210, 2475],
        [2475, 2740],
        [2740, 3005],
        [3005, 3270],
        [3270, 3535],
        [3535, 3800],
    ];

    // ==========================================
    // --- Input & Record Handling ---
    // ==========================================

    private onTouchDown = (event: APJS.IEvent) => {
        const touch = event.args[0] as APJS.TouchData;
        if (touch.phase !== APJS.TouchPhase.Began) return;

        // ✅ FIXED — block input if ball already hit
        if (!this.isPlaying || this.isReleasing || this.isBallHit) return;

        this.isHolding = true;
        console.log("Holding — club oscillating!");
    };

    private onTouchUp = (event: APJS.IEvent) => {
        const touch = event.args[0] as APJS.TouchData;
        if (touch.phase !== APJS.TouchPhase.Ended) return;

        // ✅ FIXED — block input if ball already hit
        if (!this.isPlaying || !this.isHolding || this.isBallHit) return;

        this.releaseAngle = this.currentAngle;
        this.isHolding = false;
        this.isReleasing = true;
        console.log("Released! Saved Swing Angle: " + this.releaseAngle);
    };

    private onRecordStart = (_event: APJS.IEvent) => {
        this.startGame();
    };

    private onRecordEnd = (_event: APJS.IEvent) => {
        this.resetGameAndClub();
    };

    // ==========================================
    // --- Lifecycle Methods ---
    // ==========================================

    onStart() {
        APJS.EventManager.getGlobalEmitter().on(
            APJS.EventType.Touch, this.onTouchDown
        );
        APJS.EventManager.getGlobalEmitter().on(
            APJS.EventType.Touch, this.onTouchUp
        );
        APJS.EventManager.getGlobalEmitter().on(
            APJS.EventType.RecordStart, this.onRecordStart
        );
        APJS.EventManager.getGlobalEmitter().on(
            APJS.EventType.RecordEnd, this.onRecordEnd
        );

        console.log("CombinedGameController Ready!");
    }

    onUpdate(deltaTime: number) {

        // --- Initialize references ---
        if (!this.initialized) {
            if (this.ballObject && this.cameraObject && this.golfBatObject) {
                this.ballRigidBody = this.ballObject
                    .getComponent("RigidBody2D") as APJS.RigidBody2D;
                this.ballTransform = this.ballObject.getTransform();
                this.cameraTransform = this.cameraObject.getTransform();
                this.clubTransform = this.golfBatObject.getTransform();
                this.setClubAngle(this.minAngle);
                this.initialized = true;
                console.log("CombinedGameController: Initialized!");
            }
        }

        // --- Audio init ---
        if (!this.hitAudioInitialized && this.hitSoundPlayer) {
            this.hitAudio = this.hitSoundPlayer
                .getComponent("AudioComponent") as APJS.AudioComponent;
            if (this.hitAudio) this.hitAudioInitialized = true;
        }

        if (!this.isPlaying) return;

        // --- Club oscillation ---
        if (this.isHolding) {
            this.currentAngle += this.oscillationDirection
                * this.oscillationSpeed * deltaTime;

            if (this.currentAngle >= this.maxAngle) {
                this.currentAngle = this.maxAngle;
                this.oscillationDirection = -1;
            } else if (this.currentAngle <= this.minAngle) {
                this.currentAngle = this.minAngle;
                this.oscillationDirection = 1;
            }

            this.setClubAngle(this.currentAngle);

        } else if (this.isReleasing) {
            this.currentAngle -= this.returnSpeed * deltaTime;

            if (this.currentAngle <= this.minAngle) {
                this.currentAngle = this.minAngle;
                this.isReleasing = false;
                this.handleBallHit(this.releaseAngle);
            }

            this.setClubAngle(this.currentAngle);
        }

        // --- Camera follow ball ---
        if (this.isBallHit && this.isFollowingBall
            && this.ballTransform && this.cameraTransform) {
            const ballPos = this.ballTransform.localPosition;
            const camPos = this.cameraTransform.localPosition;

            const newX = camPos.x + (ballPos.x - camPos.x)
                * this.cameraFollowSpeed * deltaTime;
            const newY = camPos.y + (ballPos.y - camPos.y)
                * this.cameraFollowSpeed * deltaTime;

            this.cameraTransform.localPosition =
                new APJS.Vector3f(newX, newY, camPos.z);
        }

        // --- Plank hide timer ---
        if (this.isBallHit && !this.plankHidden) {
            this.plankTimer += deltaTime;
            if (this.plankTimer >= this.plankHideDelay) {
                this.hidePlank();
            }
        }

        // --- Result check after plank hidden ---
        if (this.plankHidden && !this.resultShown && this.ballRigidBody) {
            const vel = Math.abs(this.ballRigidBody.velocity.x);
            if (vel <= this.velocityThreshold) {
                this.calculateResult();
            }
        }
    }

    // ==========================================
    // --- Core Action Methods ---
    // ==========================================

    private setClubAngle(angle: number): void {
        if (!this.clubTransform) return;

        this.clubTransform.localRotation =
            APJS.Quaternionf.makeFromAngleAxis(
                angle * (Math.PI / 180),
                new APJS.Vector3f(0, 0, -1)
            );
    }

    private handleBallHit(swingAngle: number): void {
        if (!this.ballRigidBody || !this.ballTransform) {
            console.warn("Ball components not ready!");
            return;
        }

        this.isBallHit = true;
        this.isFollowingBall = true;
        this.plankTimer = 0;

        // Enable ball physics
        this.ballRigidBody.static = false;

        // Map swing angle to velocity
        const totalRange = this.maxAngle - this.minAngle;
        const normalizedAngle = totalRange > 0
            ? (swingAngle - this.minAngle) / totalRange : 0;
        const xVelocity = normalizedAngle * this.velocityMultiplier;

        this.ballRigidBody.velocity = new APJS.Vector2f(xVelocity, 0);

        // Play hit sound
        if (this.hitAudio) {
            this.hitAudio.stop();
            this.hitAudio.loopCount = 1;
            this.hitAudio.volume = 100;
            this.hitAudio.play();
        }

        // Zoom out camera
        if (this.cameraTransform) {
            this.cameraTransform.localScale = new APJS.Vector3f(
                this.cameraZoomOutScale,
                this.cameraZoomOutScale,
                1
            );
        }

        console.log("Ball hit! Velocity: " + xVelocity);
    }

    private hidePlank(): void {
        this.plankHidden = true;
        this.Do_it = true;

        if (this.longPlank1Object) {
            this.longPlank1Object.enabled = false;
        }

        if (this.golfBatObject) {
            this.golfBatObject.enabled = false;
        }

        console.log("Plank hidden — waiting for ball to settle...");
    }

    private calculateResult(): void {
        this.resultShown = true;
        this.isFollowingBall = false;

        if (!this.ballObject) return;

        const screenTrans = this.ballObject
            .getComponent("ScreenTransform") as APJS.ScreenTransform;
        if (!screenTrans) return;

        const ballX = screenTrans.anchoredPosition.x;
        console.log("Ball settled at X: " + ballX);

        const winnerIdx = this.getWinnerIndexAtX(ballX);
        this.winnerIndex = winnerIdx;
        this.isWinnerReady = true;
        console.log("Winner index for VS: " + winnerIdx);
    }

    private getWinnerIndexAtX(x: number): number {
        for (let i = 0; i < this.vehicleRanges.length; i++) {
            if (x >= this.vehicleRanges[i][0]
                && x < this.vehicleRanges[i][1]) {
                return i;
            }
        }
        return 14; // ericksha default
    }

    // ==========================================
    // --- State Reset ---
    // ==========================================

    private startGame(): void {
        this.resetGameAndClub();
        this.isPlaying = true;
        console.log("CombinedGameController: Game Started!");
    }

    private resetGameAndClub(): void {
        this.Do_it = false;

        if (this.cameraTransform) {
            this.cameraTransform.localPosition =
                new APJS.Vector3f(-2.425, 0, 40);
        }

        if (this.golfBatObject) {
            this.golfBatObject.enabled = true;
        }

        if (this.ballRigidBody) {
            this.ballRigidBody.static = false;
        }

        this.isPlaying = false;
        this.isBallHit = false;
        this.isFollowingBall = false;
        this.resultShown = false;
        this.plankTimer = 0;
        this.isHolding = false;
        this.isReleasing = false;
        this.oscillationDirection = 1;
        this.currentAngle = this.minAngle;
        this.releaseAngle = this.minAngle;
        this.setClubAngle(this.minAngle);
        this.winnerIndex = -1;
        this.isWinnerReady = false;
        this.plankHidden = false;

        console.log("CombinedGameController: Fully Reset!");
    }

    onDestroy(): void {
        APJS.EventManager.getGlobalEmitter().off(
            APJS.EventType.Touch, this.onTouchDown
        );
        APJS.EventManager.getGlobalEmitter().off(
            APJS.EventType.Touch, this.onTouchUp
        );
        APJS.EventManager.getGlobalEmitter().off(
            APJS.EventType.RecordStart, this.onRecordStart
        );
        APJS.EventManager.getGlobalEmitter().off(
            APJS.EventType.RecordEnd, this.onRecordEnd
        );
    }
}