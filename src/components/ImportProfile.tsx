import { useRef, useState, type DragEvent } from 'react';
import { Upload, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardBody } from './Card';
import { importMobileconfig, type MobileconfigImportResult } from '@/lib/mobileconfigImport';
import type { KnownApp } from '@/lib/types';
import { cn } from '@/lib/cn';

interface Props {
  knownApps: KnownApp[];
  nextId: number;
  onImported: (result: MobileconfigImportResult) => void;
}

export function ImportProfile({ knownApps, nextId, onImported }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const text = await file.text();
      const result = importMobileconfig(text, knownApps, nextId);
      onImported(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    void handleFile(e.dataTransfer.files[0]);
  }

  return (
    <Card>
      <CardHeader
        icon={<Upload className="w-4 h-4" />}
        title="Import Existing Profile"
        subtitle="Load a PPPC .mobileconfig and convert it to Settings Catalog"
      />
      <CardBody>
        <label
          className={cn(
            'relative flex flex-col items-center justify-center p-6 rounded-md border-2 border-dashed border-border bg-background/40 cursor-pointer transition',
            dragOver && 'border-primary bg-primary/5',
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".mobileconfig"
            className="sr-only"
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <Upload className="w-8 h-8 text-muted-foreground mb-2" />
          <p className="text-sm">
            Drag & drop a{' '}
            <span className="text-primary font-medium">.mobileconfig</span> file
          </p>
          <p className="text-xs text-muted-foreground">
            Replaces your current apps and profile settings
          </p>
        </label>

        {error && (
          <div className="mt-4 flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
