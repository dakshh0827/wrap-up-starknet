import React from "react";
import { Card } from "./ui";
import { PublishSteps } from "./ui/StepIndicator";
import { 
  X, CheckCircle, Circle, Loader, 
  ArrowRight, Globe, Brain, Zap, FileText 
} from "lucide-react";
import Button from "./ui/Button";

/**
 * Unified Preview Card used across Research, Legacy, and Comparator tools
 * Provides consistent preview UI for content before minting
 */
export default function PreviewCard({
  // Header props
  title,
  subtitle,
  onClose,
  isProcessing = false,
  
  // Content props
  children,
  
  // Image (optional)
  imageUrl,
  
  // Tags/metadata
  tags = [],
  metadata = {},
  
  // Step tracking
  stepIndex = -1,
  steps = ["Save to DB", "Upload IPFS", "Sign & Mint"],
  savedRecord = null,
  ipfsHash = null,
  txDone = false,
  
  // Action props
  onCurate,
  isConnected = false,
  buttonLabel = "Curate & Mint",
  buttonDisabled = false,
}) {
  return (
    <Card 
      variant="elevated" 
      padding="none"
      className="overflow-hidden animate-fade-in border-zinc-800/50"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/80">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-xs text-zinc-400 uppercase tracking-wider">
            {subtitle || "Ready to Curate"}
          </span>
        </div>
        {onClose && (
          <button 
            onClick={onClose} 
            disabled={isProcessing}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="p-6 md:p-8">
        {/* Step Indicator - visible during processing */}
        {stepIndex >= 0 && (
          <div className="mb-8">
            <PublishSteps step={stepIndex} />
          </div>
        )}

        {/* Content Area - Two column layout if image exists */}
        <div className={`flex flex-col ${imageUrl ? 'md:flex-row' : ''} gap-6 mb-6`}>
          {imageUrl && (
            <div className="w-full md:w-1/3 aspect-video bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800">
              <img
                src={imageUrl}
                className="w-full h-full object-cover"
                alt="Preview"
                onError={(e) => (e.target.style.display = "none")}
              />
            </div>
          )}
          
          <div className="flex-1">
            {/* Title */}
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4 leading-tight">
              {title}
            </h2>
            
            {/* Custom Content */}
            {children}
            
            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {tags.map((tag, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 text-xs bg-zinc-800/50 text-zinc-300 px-3 py-1.5 rounded-lg border border-zinc-700/50"
                  >
                    {tag.icon && <tag.icon className="w-3 h-3 text-zinc-500" />}
                    {tag.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Status Rows */}
        <div className="space-y-2 mb-6">
          {[
            {
              label: "Database",
              done: !!savedRecord,
              active: stepIndex === 0,
              value: savedRecord?.id ? `ID: ${savedRecord.id.slice(-8)}` : null,
            },
            {
              label: "IPFS",
              done: !!ipfsHash,
              active: stepIndex === 1,
              value: ipfsHash ? `${ipfsHash.slice(0, 16)}...` : null,
            },
            {
              label: "Blockchain",
              done: txDone,
              active: stepIndex === 2,
              value: null,
            },
          ].map((row) => (
            <div
              key={row.label}
              className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-all duration-300 ${
                row.done
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : row.active
                  ? "border-emerald-500/50 bg-emerald-500/10"
                  : "border-zinc-800 bg-zinc-900/50"
              }`}
            >
              <div className="flex items-center gap-3">
                {row.done ? (
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                ) : row.active ? (
                  <Loader className="w-5 h-5 text-emerald-500 animate-spin" />
                ) : (
                  <Circle className="w-5 h-5 text-zinc-600" />
                )}
                <span
                  className={`font-medium ${
                    row.done
                      ? "text-emerald-400"
                      : row.active
                      ? "text-white"
                      : "text-zinc-500"
                  }`}
                >
                  {row.label}
                </span>
              </div>
              {row.value && (
                <span className="font-mono text-xs text-zinc-500">
                  {row.value}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Action Footer */}
        <div className="flex justify-end pt-6 border-t border-zinc-800">
          <Button
            onClick={onCurate}
            disabled={buttonDisabled || isProcessing || txDone || !isConnected}
            variant={txDone ? "success" : !isConnected ? "secondary" : "primary"}
            size="lg"
            loading={isProcessing && !txDone}
            icon={!isProcessing && !txDone && isConnected ? ArrowRight : undefined}
            iconPosition="right"
          >
            {!isConnected ? "Connect Wallet to Mint" : buttonLabel}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/**
 * Feature Grid used on tool landing pages
 */
export function FeatureGrid({ features }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {features.map((feature, idx) => (
        <Card 
          key={idx} 
          variant="interactive"
          padding="lg"
          className="group"
        >
          <div className="w-14 h-14 bg-zinc-800 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-emerald-500/10 transition-all duration-300 border border-zinc-700 group-hover:border-emerald-500/30">
            <feature.icon className={`w-7 h-7 text-zinc-400 group-hover:text-emerald-400 transition-colors ${feature.iconColor || ''}`} />
          </div>
          <h3 className="text-xl font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">
            {feature.title}
          </h3>
          <p className="text-zinc-500 leading-relaxed">
            {feature.description}
          </p>
        </Card>
      ))}
    </div>
  );
}
