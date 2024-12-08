import { useEffect, useRef, useState } from "react";

import {
  PREVIEW_FRAME_WIDTH,
  SECONDARY_FONT,
  SMALL_FONT_SIZE,
  TIMELINE_OFFSET_CANVAS_LEFT,
  TIMELINE_OFFSET_X,
} from "../constants/constants";
import { formatTimelineUnit } from "@/pages/editor/utils/format";
import useStore from "@/pages/editor/store/use-store";

interface RulerProps {
  height?: number;
  longLineSize?: number;
  shortLineSize?: number;
  offsetX?: number;
  textOffsetY?: number;
  scrollPos?: number;
  textFormat?: (scale: number) => string;
  scrollLeft?: number;
  onClick?: (units: number) => void;
}

const Ruler = (props: RulerProps) => {
  const {
    height = 40, // Increased height to give space for the text
    longLineSize = 8,
    shortLineSize = 6,
    offsetX = TIMELINE_OFFSET_X + TIMELINE_OFFSET_CANVAS_LEFT,
    textOffsetY = 12, // Place the text above the lines but inside the canvas
    textFormat = formatTimelineUnit,
    scrollLeft: scrollPos = 0,
    onClick,
  } = props;
  const { scale } = useStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasContext, setCanvasContext] =
    useState<CanvasRenderingContext2D | null>(null);
  const [canvasSize, setCanvasSize] = useState({
    width: 0,
    height: height, // Increased height for text space
  });

  // test seek
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext("2d");
      setCanvasContext(context);
      resize(canvas, context, scrollPos);
    }
  }, []);

  useEffect(() => {
    if (canvasContext) {
      resize(canvasRef.current, canvasContext, scrollPos);
    }
  }, [canvasContext, scrollPos, scale]);

  const resize = (
    canvas: HTMLCanvasElement | null,
    context: CanvasRenderingContext2D | null,
    scrollPos: number,
  ) => {
    if (!canvas || !context) return;

    const offsetParent = canvas.offsetParent as HTMLDivElement;
    const width = offsetParent?.offsetWidth ?? canvas.offsetWidth;
    const height = canvasSize.height;

    canvas.width = width;
    canvas.height = height;

    draw(context, scrollPos, width, height);
    setCanvasSize({ width, height });
  };

  const draw = (
    context: CanvasRenderingContext2D,
    scrollPos: number,
    width: number,
    height: number,
  ) => {
    const zoom = scale.zoom;
    const unit = scale.unit;
    const segments = scale.segments;
    context.clearRect(0, 0, width, height);
    context.save();
    context.strokeStyle = "#71717a";
    context.fillStyle = "#71717a";
    context.lineWidth = 1;
    context.font = `${SMALL_FONT_SIZE}px ${SECONDARY_FONT}`;
    context.textBaseline = "top";

    context.translate(0.5, 0);
    context.beginPath();

    const zoomUnit = unit * zoom * PREVIEW_FRAME_WIDTH;
    const minRange = Math.floor(scrollPos / zoomUnit);
    const maxRange = Math.ceil((scrollPos + width) / zoomUnit);
    const length = maxRange - minRange;

    // Draw text before drawing the lines
    for (let i = 0; i <= length; ++i) {
      const value = i + minRange;

      if (value < 0) continue;

      const startValue = (value * zoomUnit) / zoom;
      const startPos = (startValue - scrollPos / zoom) * zoom;

      if (startPos < -zoomUnit || startPos >= width + zoomUnit) continue;
      const text = textFormat(startValue);

      // Calculate the textOffsetX value
      const textWidth = context.measureText(text).width;
      const textOffsetX = -textWidth / 2;

      // Adjust textOffsetY so it stays inside the canvas but above the lines
      context.fillText(text, startPos + textOffsetX + offsetX, textOffsetY);
    }

    // Draw long and short lines after the text
    for (let i = 0; i <= length; ++i) {
      const value = i + minRange;

      if (value < 0) continue;

      const startValue = value * zoomUnit;
      const startPos = startValue - scrollPos + offsetX;

      for (let j = 0; j < segments; ++j) {
        const pos = startPos + (j / segments) * zoomUnit;

        if (pos < 0 || pos >= width) continue;

        const lineSize = j % segments ? shortLineSize : longLineSize;

        // Set color based on line size
        if (lineSize === shortLineSize) {
          context.strokeStyle = "#a1a1aa"; // Yellow for short lines
        } else {
          context.strokeStyle = "#d4d4d8"; // Red for long lines
        }

        const origin = 32; // Increase the origin to start lines lower, below the text

        const [x1, y1] = [pos, origin];
        const [x2, y2] = [x1, y1 + lineSize];

        context.beginPath(); // Begin a new path for each line
        context.moveTo(x1, y1);
        context.lineTo(x2, y2);
        context.stroke(); // Draw the line
      }
    }

    context.restore();
  };

  /// test seek //////

  const handleTimelineClick = (clickX: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !onClick) return;

    const rect = canvas.getBoundingClientRect();
    const timelineStart = TIMELINE_OFFSET_X + TIMELINE_OFFSET_CANVAS_LEFT;
    const relativePosition = clickX - rect.left - timelineStart;

    console.log({
      clickX,
      timelineStart,
      relativePosition,
      scale: scale.zoom,
      scrollPos
    });

    if (relativePosition >= 0) {
      onClick(relativePosition + scrollPos);
    }
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    setIsDragging(true);
    handleTimelineClick(event.clientX);
  };

  // Move handleMouseMove to document level when dragging starts
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isDragging) return;
      handleTimelineClick(event.clientX);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      // Add document-level event listeners when dragging starts
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    // Cleanup
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]); // Depend on isDragging state
  // test end here



  return (
    <div
      className="border-t border-border"
      style={{
        position: "relative",
        width: "100%",
        height: `${canvasSize.height}px`,
        backgroundColor: "transparent",
      }}
    >

      <canvas
        ref={canvasRef}
        height={canvasSize.height}
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '32px'
        }}
      />

      {/* Clickable Area */}
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '44px', // Height to cover scale and extend to line
          cursor: 'pointer',
          zIndex: 1 // Ensure it's above canvas but below other elements
        }}
        onMouseDown={handleMouseDown}
      />
      
      {/* Separate Line */}
      <div 
        style={{
          position: 'absolute',
          top: '42px',
          left: 0,
          width: '100%',
          height: '2px',
          backgroundColor: '#d4d4d8',
          pointerEvents: 'none'
        }}
      />
    </div>
  );
};

export default Ruler;
