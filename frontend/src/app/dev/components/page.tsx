"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import { Toast } from "@/components/ui/toast";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { DocumentCard } from "@/components/ui/document-card";
import { AnalyteRow } from "@/components/ui/analyte-row";
import { DisclaimerBanner } from "@/components/ui/disclaimer-banner";
import { Activity, Search, Pill, Shield } from "lucide-react";

export default function DevComponentsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [switchChecked, setSwitchChecked] = useState(true);
  const [checkboxChecked, setCheckboxChecked] = useState(true);

  return (
    <div className="min-h-screen bg-slate-50 p-6 sm:p-10 space-y-12 max-w-7xl mx-auto font-sans">
      <header className="space-y-2 border-b border-slate-200 pb-6">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Step C Foundation</Badge>
          <span className="text-xs text-slate-500 font-mono">Tailwind 3.4 + Clinical Tokens</span>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-950 font-display tracking-tight">
          HealthSync UI Component Kit & State Catalog
        </h1>
        <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
          Comprehensive showcase verifying default, hover, focus, disabled, loading, and error states across all design-system components.
        </p>
      </header>

      {/* 1. BUTTONS */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-950 font-display">1. Buttons & Variants</h2>
        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Primary (Default)</Button>
              <Button variant="secondary">Secondary (Cyan)</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="subtle">Subtle</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Small (32px)</Button>
              <Button size="md">Medium (40px)</Button>
              <Button size="lg">Large (48px)</Button>
              <Button size="icon" aria-label="Activity"><Activity className="w-4 h-4" /></Button>
              <Button isLoading>Loading State</Button>
              <Button disabled>Disabled State</Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 2. STATUS BADGES & REGULAR BADGES */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-950 font-display">2. Status Badges (Mandatory Icon + Label)</h2>
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status="optimal" label="Optimal (92 mg/dL)" />
              <StatusBadge status="normal" label="Normal Range" />
              <StatusBadge status="warning" label="Elevated (Borderline)" />
              <StatusBadge status="critical" label="Critical High" />
              <StatusBadge status="info" label="Verified Lab Result" />
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
              <Badge variant="default">Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="warning">Warning</Badge>
              <Badge variant="critical">Critical</Badge>
              <Badge variant="info">Info</Badge>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 3. INPUTS & SELECTS */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-950 font-display">3. Form Fields & Interactive Controls</h2>
        <Card>
          <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Default Input</label>
              <Input placeholder="Enter patient name..." />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">With Search Icon</label>
              <Input leftIcon={<Search className="w-4 h-4" />} placeholder="Search records..." />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Error State</label>
              <Input error="Invalid dosage value" defaultValue="10000 mg" />
              <span className="text-xs text-rose-600 font-medium">Exceeds daily maximum</span>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Disabled Input</label>
              <Input disabled defaultValue="Locked patient identifier: #HS-904" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Select Dropdown</label>
              <Select defaultValue="prescription">
                <option value="prescription">Prescription Document</option>
                <option value="lab">Lab Biomarker Report</option>
                <option value="imaging">Diagnostic Imaging</option>
              </Select>
            </div>
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="chk-sample"
                  checked={checkboxChecked}
                  onCheckedChange={setCheckboxChecked}
                />
                <label htmlFor="chk-sample" className="text-xs font-semibold text-slate-800 cursor-pointer">
                  Checkbox (Active / Focus)
                </label>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="sw-sample"
                  checked={switchChecked}
                  onCheckedChange={setSwitchChecked}
                />
                <label htmlFor="sw-sample" className="text-xs font-semibold text-slate-800 cursor-pointer">
                  Switch Toggle
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 4. CUSTOM CLINICAL COMPONENTS */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-950 font-display">4. Custom Clinical Components</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title="Total Analytes"
            value="48"
            subtitle="Extracted across 12 panels"
            icon={<Activity className="w-5 h-5" />}
            trend={{ direction: "up", value: "+4 this month", isPositive: true }}
          />
          <StatCard
            title="Adherence Score"
            value="94.2%"
            subtitle="32 consecutive days"
            icon={<Pill className="w-5 h-5" />}
            trend={{ direction: "neutral", value: "Optimal adherence", isPositive: true }}
          />
          <StatCard
            title="Pending Reviews"
            value="1"
            subtitle="Requires dosage check"
            icon={<Shield className="w-5 h-5" />}
            trend={{ direction: "down", value: "High priority", isPositive: false }}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 font-display">
              AnalyteRow Component
            </h3>
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-card space-y-2.5">
              <AnalyteRow
                name="Fasting Plasma Glucose"
                value="92"
                unit="mg/dL"
                referenceRange="70 - 99 mg/dL"
                status="normal"
              />
              <AnalyteRow
                name="HbA1c (Glycated Hemoglobin)"
                value="5.5"
                unit="%"
                referenceRange="< 5.7 %"
                status="optimal"
              />
              <AnalyteRow
                name="Total Serum Cholesterol"
                value="208"
                unit="mg/dL"
                referenceRange="< 200 mg/dL"
                status="warning"
                statusLabel="Slightly High"
              />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 font-display">
              DocumentCard Component
            </h3>
            <DocumentCard
              id="sample-doc-1"
              title="Comprehensive Metabolic Panel (CMP)"
              category="Lab Report"
              date="Nov 14, 2026"
              doctor="Dr. Sarah Jenkins"
              facility="Quest Diagnostics"
              confidence={0.96}
            />
          </div>
        </div>

        <div className="pt-2">
          <DisclaimerBanner />
        </div>
      </section>

      {/* 5. TABS, PROGRESS & SKELETON */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-950 font-display">5. Tabs, Progress & Skeletons</h2>
        <Card>
          <CardContent className="p-6 space-y-6">
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Clinical Overview</TabsTrigger>
                <TabsTrigger value="biomarkers">Biomarkers</TabsTrigger>
                <TabsTrigger value="history">Historical Notes</TabsTrigger>
              </TabsList>
              <TabsContent value="overview">
                <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-600">
                  Tab content for clinical overview rendered seamlessly with keyboard arrow-key navigation.
                </div>
              </TabsContent>
              <TabsContent value="biomarkers">
                <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-600">
                  Tab content for laboratory analytes.
                </div>
              </TabsContent>
            </Tabs>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-700">
                <span>OCR Processing Progress</span>
                <span className="tabular-nums">75%</span>
              </div>
              <Progress value={75} />
            </div>

            <div className="space-y-2 pt-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Loading Skeletons</span>
              <div className="space-y-2">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 6. MODALS & SHEETS */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-slate-950 font-display">6. Modals, Sheets & Tooltips</h2>
        <Card>
          <CardContent className="p-6 flex flex-wrap gap-4 items-center">
            <Button onClick={() => setDialogOpen(true)}>Open Modal Dialog</Button>
            <Button variant="outline" onClick={() => setSheetOpen(true)}>Open Slideout Sheet</Button>
            <Tooltip content="Cryptographic SHA-256 hash verified">
              <Button variant="subtle">Hover for Tooltip</Button>
            </Tooltip>
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Medication Schedule</DialogTitle>
              <DialogDescription>
                Are you sure you want to activate daily morning reminders for Amoxicillin 500mg?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => setDialogOpen(false)}>Confirm Schedule</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Clinical Document Metadata</SheetTitle>
              <SheetDescription>
                Detailed extraction parameters, OCR engine logs, and security verification.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-4 text-xs text-slate-600">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <strong>File Hash: </strong>
                <span className="font-mono break-all">e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <strong>Parser Engine: </strong>
                <span>Tesseract 5.x + Google Gemini 1.5 Flash</span>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </section>
    </div>
  );
}
