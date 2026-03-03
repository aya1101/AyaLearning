import React, { useCallback, useEffect, useRef, useState } from 'react';

const Live2DViewer = ({ modelPath, className }) => {
  const canvasRef = useRef(null);
  const modelRef = useRef(null);
  const lipSyncRef = useRef({
    audioContext: null,
    analyser: null,
    animationFrameId: null,
    sourceNode: null,
    audioElement: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const setMouthOpen = useCallback((value) => {
    const model = modelRef.current;
    const coreModel = model?.internalModel?.coreModel;
    if (!coreModel) return;

    const clampedValue = Math.max(0, Math.min(1, value));
    try {
      coreModel.setParameterValueById('ParamMouthOpenY', clampedValue);
      coreModel.setParameterValueById('PARAM_MOUTH_OPEN_Y', clampedValue);
    } catch (err) {
      console.warn('Failed to set mouth parameter:', err);
    }
  }, []);

  const stopLipSync = useCallback(() => {
    const lipSync = lipSyncRef.current;

    if (lipSync.animationFrameId) {
      cancelAnimationFrame(lipSync.animationFrameId);
    }

    if (lipSync.audioElement) {
      lipSync.audioElement.onended = null;
    }

    if (lipSync.sourceNode) {
      try {
        lipSync.sourceNode.disconnect();
      } catch (err) {
        console.warn('Failed to disconnect lip-sync source node:', err);
      }
    }

    if (lipSync.analyser) {
      try {
        lipSync.analyser.disconnect();
      } catch (err) {
        console.warn('Failed to disconnect lip-sync analyser:', err);
      }
    }

    if (lipSync.audioContext) {
      lipSync.audioContext.close().catch(() => {});
    }

    lipSyncRef.current = {
      audioContext: null,
      analyser: null,
      animationFrameId: null,
      sourceNode: null,
      audioElement: null
    };

    setMouthOpen(0);
  }, [setMouthOpen]);

  const startLipSync = useCallback((audioElement) => {
    if (!audioElement) return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    stopLipSync();

    const audioContext = new AudioContextClass();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;

    const sourceNode = audioContext.createMediaElementSource(audioElement);
    sourceNode.connect(analyser);
    analyser.connect(audioContext.destination);

    const dataArray = new Uint8Array(analyser.fftSize);

    const animate = () => {
      analyser.getByteTimeDomainData(dataArray);
      let sumSquares = 0;

      for (let index = 0; index < dataArray.length; index += 1) {
        const normalized = (dataArray[index] - 128) / 128;
        sumSquares += normalized * normalized;
      }

      const rms = Math.sqrt(sumSquares / dataArray.length);
      const mouthOpen = Math.min(1, rms * 7);
      setMouthOpen(mouthOpen);

      lipSyncRef.current.animationFrameId = requestAnimationFrame(animate);
    };

    lipSyncRef.current = {
      audioContext,
      analyser,
      animationFrameId: requestAnimationFrame(animate),
      sourceNode,
      audioElement
    };

    audioElement.onended = () => stopLipSync();
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }
  }, [setMouthOpen, stopLipSync]);

  useEffect(() => {
    let app = null;
    let model = null;
    let resizeHandler = null;

    const initializeLive2D = async () => {
      try {
        console.log('Initializing Live2D with model:', modelPath);
        
        // Wait for libraries to load from CDN
        if (!window.PIXI) {
          console.error('PIXI.js not loaded');
          setError('PIXI.js library not loaded. Please refresh the page.');
          setLoading(false);
          return;
        }

        if (!window.PIXI.live2d) {
          console.error('pixi-live2d-display not loaded');
          setError('Live2D plugin not loaded. Please refresh the page.');
          setLoading(false);
          return;
        }

        console.log('PIXI and Live2D libraries loaded from CDN');
        const PIXI = window.PIXI;

        // Create PIXI application
        app = new PIXI.Application({
          view: canvasRef.current,
          autoStart: true,
          resizeTo: canvasRef.current.parentElement,
          transparent: true,
          resolution: window.devicePixelRatio || 1,
          antialias: true
        });

        console.log('PIXI Application created, loading model from:', modelPath);

        // Load Live2D model
        model = await PIXI.live2d.Live2DModel.from(modelPath);

        console.log('Live2D model loaded successfully:', model);
        setLoading(false);

        // Scale and position model to fill ~60% of container
        const scaleModel = () => {
          const containerWidth = app.view.width;
          const containerHeight = app.view.height;
          
          const scaleX = containerWidth / model.width;
          const scaleY = containerHeight / model.height;
          
          // Scale to fit container
          const scale = Math.min(scaleX, scaleY) * 1.0;

          model.scale.set(scale);
          
          // Position in left half and higher up to show head and shoulders
          model.x = containerWidth * 0.3; // 30% from left edge
          model.y = containerHeight * 0.48; // 48% from top - higher to show full upper body
        };

        model.anchor.set(0.5, 0.5);
        app.stage.addChild(model);
        modelRef.current = model;
        
        // Initial scale
        scaleModel();

        // Auto rescale on window resize for responsive behavior
        resizeHandler = () => {
          if (model && !model.destroyed) {
            scaleModel();
          }
        };
        window.addEventListener('resize', resizeHandler);

        // Auto blink
        if (model.internalModel.motionManager) {
          model.internalModel.motionManager.autoBlinking = true;
        }

        // Enable drag to move
        model.interactive = true;
        model.buttonMode = true;
        
        let dragOffset = { x: 0, y: 0 };
        let isDragging = false;

        model.on('pointerdown', (event) => {
          isDragging = true;
          const position = event.data.global;
          dragOffset.x = position.x - model.x;
          dragOffset.y = position.y - model.y;
        });

        model.on('pointerup', () => {
          isDragging = false;
        });

        model.on('pointerupoutside', () => {
          isDragging = false;
        });

        model.on('pointermove', (event) => {
          if (isDragging) {
            const position = event.data.global;
            model.x = position.x - dragOffset.x;
            model.y = position.y - dragOffset.y;
          }
        });

        // Add idle animation
        if (model.internalModel.motionManager && model.internalModel.motionManager.groups.idle) {
          model.motion('idle', 0, window.PIXI.live2d.MotionPriority.IDLE);
        }

      } catch (error) {
        console.error('Failed to load Live2D model:', error);
        setError(`Failed to load model: ${error.message}`);
        setLoading(false);
      }
    };

    // Initialize with delay to ensure DOM is ready
    const timer = setTimeout(() => {
      initializeLive2D();
    }, 100);

    // Cleanup
    return () => {
      clearTimeout(timer);
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
      }
      stopLipSync();
      if (model) {
        model.destroy();
      }
      if (app) {
        app.destroy(true, { children: true, texture: true, baseTexture: true });
      }
    };
  }, [modelPath, stopLipSync]);

  // Trigger expressions/motions
  const triggerExpression = (expressionName) => {
    if (modelRef.current && modelRef.current.internalModel.motionManager) {
      try {
        modelRef.current.expression(expressionName);
      } catch (err) {
        console.warn('Expression not found:', expressionName);
      }
    }
  };

  const triggerMotion = (motionGroup, motionIndex = 0) => {
    if (modelRef.current && modelRef.current.internalModel.motionManager) {
      try {
        modelRef.current.motion(motionGroup, motionIndex, window.PIXI.live2d.MotionPriority.NORMAL);
      } catch (err) {
        console.warn('Motion not found:', motionGroup);
      }
    }
  };

  // Expose methods to parent
  useEffect(() => {
    if (window.live2dController) {
      window.live2dController.triggerExpression = triggerExpression;
      window.live2dController.triggerMotion = triggerMotion;
      window.live2dController.startLipSync = startLipSync;
      window.live2dController.stopLipSync = stopLipSync;
    } else {
      window.live2dController = {
        triggerExpression,
        triggerMotion,
        startLipSync,
        stopLipSync
      };
    }
  });

  return (
    <div className={`relative ${className || ''}`} style={{ width: '100%', height: '100%' }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-amber-50 to-yellow-50">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent mb-4"></div>
            <p className="text-gray-600">Loading Live2D model...</p>
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50">
          <div className="text-center p-6">
            <div className="text-6xl mb-4">⚠️</div>
            <p className="text-red-600 font-semibold mb-2">Live2D Error</p>
            <p className="text-sm text-gray-600">{error}</p>
            <p className="text-xs text-gray-500 mt-2">Check console for details</p>
          </div>
        </div>
      )}
      
      <canvas 
        ref={canvasRef} 
        style={{ 
          width: '100%', 
          height: '100%',
          display: loading || error ? 'none' : 'block'
        }}
      />
      
      {!loading && !error && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-xs text-gray-400 text-center">
          <p>Click and drag to move • Auto animations</p>
        </div>
      )}
    </div>
  );
};

export default Live2DViewer;
