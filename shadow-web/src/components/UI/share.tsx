"use client";
import { useState } from "react";
import QRCode from "react-qr-code";
import button from "./button";

export default function ShareButton() {
  const [showShareModal, setShowShareModal] = useState<boolean>(false);

  return (
    <>
      <button
        className={button({
          color: "primary",
          size: "sm",
          className: "font-medium",
        })}
        onClick={() => setShowShareModal(true)}
      >
        Share
      </button>
      {showShareModal ? (
        <ShareModal onCloseClick={() => setShowShareModal(false)} />
      ) : null}
    </>
  );
}

type ShareModalProps = {
  onCloseClick(): void;
};

const ShareModal = (props: ShareModalProps) => {
  return (
    <div className="fixed inset-0 z-10 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4 pt-4 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity">
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>
        <span className="hidden sm:inline-block sm:h-screen sm:align-middle"></span>
        <div className="inline-block transform rounded-lg bg-gray-700 px-4 pb-4 pt-5 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6 sm:align-middle">
          <div className="align-center flex w-full flex-col sm:items-start">
            <button
              className={button({
                color: "primary",
                size: "sm",
                className: "self-end rounded-md font-medium shadow-sm",
              })}
              onClick={props.onCloseClick}
            >
              X
            </button>
            <div className="relative mt-3 text-center">
              <h3 className="4xl:text-2xl text-lg font-medium leading-6 text-gray-100">
                Share Room
              </h3>
              <div className="mt-2">
                <p className="4xl:text-lg text-sm leading-5 text-gray-300">
                  You can share a room either by URL or QRCode. Press either one
                  of the options below and it will be copied to your clipboard.
                </p>
              </div>
            </div>
            <URLSection />
            <div className="4xl:text-lg flex w-full items-center pt-2 text-sm">
              <div className="4xl:border-t-2 flex-grow border-t border-gray-300"></div>
              <span className="mx-4 flex-shrink text-gray-300">Or</span>
              <div className="4xl:border-t-2 flex-grow border-t border-gray-300"></div>
            </div>
            <QRSection />
          </div>
        </div>
      </div>
    </div>
  );
};

const URLSection = () => {
  const [copied, setCopied] = useState<boolean>(false);

  const copyURLToClipboard = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="relative mt-4 w-auto max-w-full cursor-pointer select-none self-center rounded-md bg-gray-600 text-gray-300 transition duration-150 ease-in-out hover:bg-gray-500"
      onClick={() => (!copied ? copyURLToClipboard() : null)}
    >
      <div className="w-auto overflow-x-scroll">
        <p className="4xl:text-lg break-keep p-2 text-sm leading-5">
          {window.location.href}
        </p>
      </div>
      <div className="overflow-x-visible">{copied && <CopiedPopover />}</div>
    </div>
  );
};

const QRSection = () => {
  const [copied, setCopied] = useState<boolean>(false);

  const copySVGToClipboard = (element: SVGSVGElement) => {
    copySVGAsImage(element);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative mt-2 cursor-pointer self-center rounded-lg bg-white p-2">
      <QRCode
        onClick={(e) => (!copied ? copySVGToClipboard(e.currentTarget) : null)}
        value={window.location.href}
        level={"M"}
        size={128}
      />
      {copied && <CopiedPopover />}
    </div>
  );
};

const CopiedPopover = () => {
  return (
    <div className="4xl:-top-12 4xl:text-lg 4xl:before:border-8 absolute -top-10 left-1/2 -translate-x-1/2 rounded-md bg-gray-500 px-3 py-1 text-sm text-white shadow-md before:absolute before:left-1/2 before:top-full before:-translate-x-1/2 before:border-4 before:border-transparent before:border-t-gray-500 before:content-['']">
      Copied!
    </div>
  );
};

const copySVGAsImage = (target: SVGSVGElement) => {
  const svgString = new XMLSerializer().serializeToString(target);
  const svgBlob = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.src = url;
  img.onload = async () => {
    URL.revokeObjectURL(url);

    const canvas = document.createElement("canvas");
    const padding = 40;
    canvas.width = target.clientWidth + padding + 40;
    canvas.height = target.clientHeight + padding + 40;

    const qrSize = target.clientWidth; // Size of the QR code
    const size = qrSize;
    const cornerRadius = 6;
    const squarePadding = 6;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate position for QR code
    const x = (canvas.width - size) / 2;
    const y = (canvas.height - size - padding / 2) / 2;

    // Draw rounded rectangle with padding around QR code
    const rectX = x - squarePadding;
    const rectY = y - squarePadding;
    const rectWidth = size + squarePadding * 2;
    const rectHeight = size + squarePadding * 2;

    ctx.beginPath();
    ctx.moveTo(rectX + cornerRadius, rectY);
    ctx.arcTo(
      rectX + rectWidth,
      rectY,
      rectX + rectWidth,
      rectY + rectHeight,
      cornerRadius,
    );
    ctx.arcTo(
      rectX + rectWidth,
      rectY + rectHeight,
      rectX,
      rectY + rectHeight,
      cornerRadius,
    );
    ctx.arcTo(rectX, rectY + rectHeight, rectX, rectY, cornerRadius);
    ctx.arcTo(rectX, rectY, rectX + rectWidth, rectY, cornerRadius);
    ctx.closePath();
    ctx.lineWidth = 2; // Set border width
    ctx.fillStyle = "white"; // Set border color
    ctx.fill();
    ctx.strokeStyle = "black"; // Set border color
    ctx.stroke();

    ctx.drawImage(
      img,
      rectX + squarePadding,
      rectY + squarePadding,
      target.clientWidth,
      target.clientHeight,
    ); // QRCode

    // Draw text below the QR code
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      "I want to share my virtual room",
      canvas.width / 2,
      y + size + 30,
    );
    ctx.fillText("with you on Shadow!", canvas.width / 2, y + size + 30 + 14);

    canvas.toBlob(async (blob) => {
      if (!blob) return;

      const clipboardItem = new ClipboardItem({ "image/png": blob });
      navigator.clipboard.write([clipboardItem]);
    }, "image/png");
  };
};
