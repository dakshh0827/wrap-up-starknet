import React from "react";
import { CheckCircle, Loader, Circle } from "lucide-react";

export default function StepIndicator({ steps, currentStep }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, i) => {
        const isDone = i < currentStep;
        const isActive = i === currentStep;
        return (
          <React.Fragment key={i}>
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 text-xs font-bold transition-all duration-300 ${
                  isDone
                    ? "bg-emerald-500 border-emerald-500 text-black"
                    : isActive
                    ? "border-emerald-500 text-emerald-500 bg-emerald-500/10"
                    : "border-zinc-700 text-zinc-600 bg-zinc-900"
                }`}
              >
                {isDone ? (
                  <CheckCircle className="w-4 h-4" />
                ) : isActive ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={`text-xs font-medium hidden sm:block transition-colors ${
                  isActive
                    ? "text-white"
                    : isDone
                    ? "text-emerald-400"
                    : "text-zinc-600"
                }`}
              >
                {step}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`w-8 h-0.5 rounded transition-all duration-300 ${
                  i < currentStep ? "bg-emerald-500" : "bg-zinc-800"
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export function PublishSteps({ step }) {
  const steps = ["Save to DB", "Upload IPFS", "Sign Tx", "Confirmed"];
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          <div className="flex items-center gap-1.5">
            {i < step ? (
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            ) : i === step ? (
              <Loader className="w-4 h-4 text-emerald-500 animate-spin" />
            ) : (
              <Circle className="w-4 h-4 text-zinc-600" />
            )}
            <span
              className={`text-xs font-medium ${
                i < step
                  ? "text-emerald-400"
                  : i === step
                  ? "text-white"
                  : "text-zinc-600"
              }`}
            >
              {s}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`w-6 h-px ${
                i < step ? "bg-emerald-500" : "bg-zinc-800"
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
