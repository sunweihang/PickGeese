import { _decorator, Camera, Color, Component, DirectionalLight, Node, UITransform, Vec3, assetManager, view } from 'cc';
import { GameController } from './game/GameController';
import {
  LETTERBOX_CLEAR,
  applyDesignResolution,
  applyPortraitCameraRect,
  applyPortraitUiCamera,
  portraitVisibleSize,
} from './game/PortraitFit';
import { preloadToyLit } from './game/ToyLit';

const { ccclass } = _decorator;

@ccclass('GameBootstrap')
export class GameBootstrap extends Component {
  private _game: { dispose?: () => void; layoutChrome?: () => void } | null = null;
  private _letterboxCam: Camera | null = null;
  private _mainCam: Camera | null = null;
  private _uiCam: Camera | null = null;
  private _canvas: Node | null = null;
  private _applyingFrame = false;

  onLoad(): void {
    const dl = assetManager.downloader as { maxRetryCount?: number; retryInterval?: number };
    if (dl) {
      dl.maxRetryCount = 0;
      dl.retryInterval = 0;
    }
    applyDesignResolution();
    this._cacheCameras();
    this._placePlayCam();
    this._tuneLighting();
    this._ensureLetterboxCam();
    this._applyPortraitFrame();
    view.on('canvas-resize', this._applyPortraitFrame, this);
    void preloadToyLit();
    this._boot();
  }

  private _placePlayCam(): void {
    const node = this._mainCam?.node;
    if (!node || !this._mainCam) return;
    node.setPosition(0, 16.8, 9.15);
    node.lookAt(new Vec3(0, 0.12, 0.28), Vec3.UNIT_Y);
    this._mainCam.fov = 38;
    this._mainCam.clearColor = new Color(168, 226, 255, 255);
    this._mainCam.usePostProcess = false;
    this._mainCam.postProcess = null;
  }

  private _tuneLighting(): void {
    const scene = this.node.scene;
    if (!scene) return;
    const shadows = scene.globals?.shadows;
    if (shadows) shadows.enabled = false;
    const ambient = scene.globals?.ambient;
    if (ambient) {
      ambient.skyIllum = 26000;
      ambient.skyColor = new Color(168, 208, 228, 140);
      ambient.groundAlbedo = new Color(115, 158, 120, 255);
    }
    const fog = scene.globals?.fog;
    if (fog) fog.enabled = false;
    const lightNode = scene.getChildByName('Directional Light');
    const light = lightNode?.getComponent(DirectionalLight);
    if (light && lightNode) {
      lightNode.setPosition(8, 16, 10);
      lightNode.setRotationFromEuler(-58, 46, 0);
      light.color = new Color(255, 236, 220, 255);
      light.illuminance = 215000;
      light.shadowEnabled = false;
    }
    const fillNode = scene.getChildByName('Fill Light');
    if (fillNode) fillNode.active = false;
  }

  onDestroy(): void {
    view.off('canvas-resize', this._applyPortraitFrame, this);
    this._game?.dispose?.();
    this._game = null;
  }

  private _boot(): void {
    this._game = GameController.create(this.node.scene!);
  }

  private _cacheCameras(): void {
    const scene = this.node.scene;
    if (!scene) return;
    this._mainCam = scene.getChildByName('Main Camera')?.getComponent(Camera) ?? null;
    this._canvas = scene.getChildByName('Canvas');
    this._uiCam = this._canvas?.getChildByName('Camera')?.getComponent(Camera) ?? null;
  }

  private _ensureLetterboxCam(): void {
    const scene = this.node.scene;
    if (!scene) return;
    let node = scene.getChildByName('LetterboxCam');
    if (!node) {
      node = new Node('LetterboxCam');
      scene.addChild(node);
      node.setPosition(0, 0, 0);
    }
    let cam = node.getComponent(Camera);
    if (!cam) cam = node.addComponent(Camera);
    cam.projection = Camera.ProjectionType.ORTHO;
    cam.orthoHeight = 10;
    cam.priority = -100;
    cam.visibility = 0;
    cam.clearFlags = Camera.ClearFlag.SOLID_COLOR;
    cam.clearColor = LETTERBOX_CLEAR;
    cam.rect.set(0, 0, 1, 1);
    this._letterboxCam = cam;
  }

  private _applyPortraitFrame = (): void => {
    if (this._applyingFrame) return;
    this._applyingFrame = true;
    try {
      applyDesignResolution();
      const vis = portraitVisibleSize();
      if (this._canvas) {
        const ui = this._canvas.getComponent(UITransform);
        if (ui) ui.setContentSize(vis.width, vis.height);
      }
      if (this._uiCam?.isValid) applyPortraitUiCamera(this._uiCam);
      if (this._mainCam?.isValid) applyPortraitCameraRect(this._mainCam);
      if (this._letterboxCam?.isValid) {
        this._letterboxCam.clearColor = LETTERBOX_CLEAR;
        this._letterboxCam.rect.set(0, 0, 1, 1);
        this._letterboxCam.enabled = true;
      }
      this._game?.layoutChrome?.();
    } finally {
      this._applyingFrame = false;
    }
  };
}
