/// <reference path="../../../dist/preview release/babylon.d.ts"/>

module BABYLON.GUI {
    /**
     * Class used to manage 3D user interface
     */
    export class GUI3DManager implements BABYLON.IDisposable {
        private _scene: Scene;
        private _sceneDisposeObserver: Nullable<Observer<Scene>>;
        private _utilityLayer: Nullable<UtilityLayerRenderer>;
        private _rootContainer: Container3D;
        private _pointerObserver: Nullable<Observer<PointerInfoPre>>;
        public _lastPickedControl: Control3D;
        /** @hidden */
        public _lastControlOver: {[pointerId:number]: Control3D} = {};
        /** @hidden */
        public _lastControlDown: {[pointerId:number]: Control3D} = {};      

        /** Gets the hosting scene */
        public get scene(): Scene {
            return this._scene;
        }

        public get utilityLayer(): Nullable<UtilityLayerRenderer> {
            return this._utilityLayer;
        }

        /**
         * Creates a new GUI3DManager
         * @param scene 
         */
        public constructor(scene?: Scene) {
            this._scene = scene || Engine.LastCreatedScene!;
            this._sceneDisposeObserver = this._scene.onDisposeObservable.add(() => {
                this._sceneDisposeObserver = null;
                this._utilityLayer = null;
                this.dispose();
            })

            this._utilityLayer = new UtilityLayerRenderer(this._scene);

            // Root
            this._rootContainer = new Container3D("RootContainer");
            this._rootContainer._host = this;
            
            // Events
            this._pointerObserver = this._scene.onPrePointerObservable.add((pi, state) => {
                let pointerEvent = <PointerEvent>(pi.event);
                if (this._scene.isPointerCaptured(pointerEvent.pointerId)) {
                    return;
                }

                if (pi.type !== BABYLON.PointerEventTypes.POINTERMOVE
                    && pi.type !== BABYLON.PointerEventTypes.POINTERUP
                    && pi.type !== BABYLON.PointerEventTypes.POINTERDOWN) {
                    return;
                }

                let camera = this._scene.cameraToUseForPointers || this._scene.activeCamera;

                if (!camera) {
                    return;
                }

                pi.skipOnPointerObservable = this._doPicking(pi.type, pointerEvent)
            });

            // Scene
            this._utilityLayer.utilityLayerScene.autoClear = false;
            this._utilityLayer.utilityLayerScene.autoClearDepthAndStencil = false;
            new BABYLON.HemisphericLight("hemi", Vector3.Up(), this._utilityLayer.utilityLayerScene);
        }

        private _doPicking(type: number, pointerEvent: PointerEvent): boolean {
            if (!this._utilityLayer || !this._utilityLayer.utilityLayerScene.activeCamera) {
                return false;                
            }

            let pointerId = pointerEvent.pointerId || 0;
            let buttonIndex = pointerEvent.button;
            var utilityScene = this._utilityLayer.utilityLayerScene;

            let pickingInfo = utilityScene.pick(this._scene.pointerX, this._scene.pointerY);
            if (!pickingInfo || !pickingInfo.hit) {
                var previousControlOver = this._lastControlOver[pointerId];
                if (previousControlOver) {
                    previousControlOver._onPointerOut(previousControlOver);
                    delete this._lastControlOver[pointerId];
                }               
                
                if (type === BABYLON.PointerEventTypes.POINTERUP) {
                    if (this._lastControlDown[pointerEvent.pointerId]) {
                        this._lastControlDown[pointerEvent.pointerId].forcePointerUp();
                        delete this._lastControlDown[pointerEvent.pointerId];
                    }
                }                
                return false;
            }

            let control = <Control3D>(pickingInfo.pickedMesh!.metadata);

            if (!control._processObservables(type, pickingInfo.pickedPoint!, pointerId, buttonIndex)) {

                if (type === BABYLON.PointerEventTypes.POINTERMOVE) {
                    if (this._lastControlOver[pointerId]) {
                        this._lastControlOver[pointerId]._onPointerOut(this._lastControlOver[pointerId]);
                    }

                    delete this._lastControlOver[pointerId];
                }
            }

            if (type === BABYLON.PointerEventTypes.POINTERUP) {
                if (this._lastControlDown[pointerEvent.pointerId]) {
                    this._lastControlDown[pointerEvent.pointerId].forcePointerUp();
                    delete this._lastControlDown[pointerEvent.pointerId];
                }
            }

            return true;
        }

        /**
         * Gets the root container
         */
        public get rootContainer(): Container3D {
            return this._rootContainer;
        }

        /**
         * Gets a boolean indicating if the given control is in the root child list
         * @param control defines the control to check
         * @returns true if the control is in the root child list
         */
        public containsControl(control: Control3D): boolean {
            return this._rootContainer.containsControl(control);
        }

        /**
         * Adds a control to the root child list
         * @param control defines the control to add
         * @returns the current manager
         */
        public addControl(control: Control3D): GUI3DManager {
           this._rootContainer.addControl(control);
           return this;
        }

        /**
         * Removes the control from the root child list
         * @param control defines the control to remove
         * @returns the current container
         */
        public removeControl(control: Control3D): GUI3DManager {
            this._rootContainer.removeControl(control);
            return this;
        }        

        /**
         * Releases all associated resources
         */
        public dispose() {
            this._rootContainer.dispose();

            if (this._scene) {
                if (this._pointerObserver) {
                    this._scene.onPrePointerObservable.remove(this._pointerObserver);
                    this._pointerObserver = null;
                }
                if (this._sceneDisposeObserver) {
                    this._scene.onDisposeObservable.remove(this._sceneDisposeObserver);
                    this._sceneDisposeObserver = null;
                }                
            }

            if (this._utilityLayer) {
                this._utilityLayer.dispose();
            }
        }
    }
}
