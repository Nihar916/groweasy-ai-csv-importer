"use client";

import { ChangeEvent, DragEvent, useState } from "react";
import Papa from "papaparse";

type CSVRow = Record<string, string>;

type ImportResult = {
  success: boolean;
  records: CSVRow[];
  skippedRecords?: CSVRow[] | number;
  totalImported: number;
  totalSkipped: number;
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<CSVRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const parseCSVFile = (selectedFile: File) => {
    setError("");
    setResult(null);

    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a valid CSV file.");
      setFile(null);
      setRows([]);
      setColumns([]);
      return;
    }

    setFile(selectedFile);

    Papa.parse<CSVRow>(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (parseResult) => {
        const parsedRows = parseResult.data;

        if (parsedRows.length === 0) {
          setError("The CSV file does not contain any records.");
          setRows([]);
          setColumns([]);
          return;
        }

        const parsedColumns = parseResult.meta.fields || [];

        setRows(parsedRows);
        setColumns(parsedColumns);
      },
      error: (parseError) => {
        console.error(parseError);
        setError("Something went wrong while reading the CSV file.");
        setRows([]);
        setColumns([]);
      },
    });
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];

    if (selectedFile) {
      parseCSVFile(selectedFile);
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const selectedFile = event.dataTransfer.files?.[0];

    if (selectedFile) {
      parseCSVFile(selectedFile);
    }
  };

  const handleConfirmImport = async () => {
    if (!file) {
      setError("Please select a CSV file first.");
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      setResult(null);

      const formData = new FormData();
      formData.append("file", file);

     const response = await fetch("/api/backend/api/import", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Import failed.");
      }

      setResult(data);
    } catch (importError) {
      console.error(importError);
      setError(
        importError instanceof Error
          ? importError.message
          : "Import failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const resultColumns =
    result?.records && result.records.length > 0
      ? Object.keys(result.records[0])
      : [];

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800 bg-slate-900/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-xl font-bold">
              GrowEasy AI CSV Importer
            </h1>

            <p className="mt-1 text-sm text-slate-400">
              Intelligent CRM lead extraction powered by AI
            </p>
          </div>

          <div className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400">
            AI Ready
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="mb-10 text-center">
          <p className="text-sm font-bold tracking-widest text-sky-400">
            SMART CRM IMPORT
          </p>

          <h2 className="mt-4 text-4xl font-bold">
            Import any CSV.
            <br />
            Let AI understand your leads.
          </h2>

          <p className="mx-auto mt-5 max-w-3xl text-slate-400">
            Upload lead data from Facebook, Google Ads, Excel, real estate
            CRMs, sales reports, or custom spreadsheets. Our AI intelligently
            maps your data into GrowEasy CRM format.
          </p>
        </div>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`rounded-2xl border p-5 transition ${
            isDragging
              ? "border-sky-400 bg-sky-500/10"
              : "border-slate-700 bg-slate-900"
          }`}
        >
          <div className="rounded-xl border-2 border-dashed border-slate-600 px-6 py-12 text-center">
            <div className="text-5xl">📄</div>

            <h3 className="mt-5 text-xl font-bold">
              Upload your CSV file
            </h3>

            <p className="mt-2 text-sm text-slate-400">
              Drag and drop your CSV here, or choose a file
            </p>

            <label className="mx-auto mt-6 flex max-w-3xl cursor-pointer items-center rounded-lg border border-slate-600 bg-slate-800 p-2">
              <span className="rounded-lg bg-sky-500 px-5 py-3 font-semibold">
                Choose File
              </span>

              <span className="ml-4 truncate text-sm text-slate-300">
                {file ? file.name : "No file selected"}
              </span>

              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            <p className="mt-4 text-xs text-slate-400">
              CSV files only
            </p>

            {file && (
              <p className="mt-4 text-sm font-semibold text-emerald-400">
                Selected: {file.name}
              </p>
            )}

            {error && (
              <p className="mt-4 text-sm font-semibold text-red-400">
                {error}
              </p>
            )}
          </div>
        </div>

        {rows.length > 0 && (
          <section className="mt-8 rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold">CSV Preview</h3>

                <p className="mt-1 text-sm text-slate-400">
                  Review your uploaded data before AI processing.
                </p>
              </div>

              <span className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold">
                {rows.length} records found
              </span>
            </div>

            <div className="max-h-[420px] overflow-auto rounded-xl border border-slate-700">
              <table className="min-w-max w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-slate-800">
                  <tr>
                    {columns.map((column) => (
                      <th
                        key={column}
                        className="whitespace-nowrap border-b border-slate-700 px-4 py-4 font-semibold"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {rows.slice(0, 100).map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className="border-b border-slate-800 hover:bg-slate-800/60"
                    >
                      {columns.map((column) => (
                        <td
                          key={`${rowIndex}-${column}`}
                          className="max-w-xs whitespace-nowrap px-4 py-3 text-slate-300"
                        >
                          {row[column] || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {rows.length > 100 && (
              <p className="mt-3 text-sm text-slate-400">
                Previewing the first 100 records for performance.
              </p>
            )}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isLoading}
                className="rounded-lg bg-emerald-600 px-6 py-3 font-semibold transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? "Processing with AI..." : "Confirm Import"}
              </button>
            </div>
          </section>
        )}

        {isLoading && (
          <section className="mt-8 rounded-2xl border border-sky-500/30 bg-sky-500/10 p-8 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-600 border-t-sky-400" />

            <h3 className="mt-5 text-xl font-bold">
              Processing your CSV
            </h3>

            <p className="mt-2 text-slate-400">
              Mapping lead information into GrowEasy CRM format...
            </p>
          </section>
        )}

        {result && !isLoading && (
          <section className="mt-8 rounded-2xl border border-emerald-500/30 bg-slate-900 p-5">
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-emerald-400">
                Parsed CRM Result
              </h3>

              <p className="mt-1 text-sm text-slate-400">
                Backend processing completed successfully.
              </p>
            </div>

            <div className="mb-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
                <p className="text-sm text-slate-400">
                  Total Imported
                </p>

                <p className="mt-2 text-3xl font-bold text-emerald-400">
                  {result.totalImported}
                </p>
              </div>

              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5">
                <p className="text-sm text-slate-400">
                  Total Skipped
                </p>

                <p className="mt-2 text-3xl font-bold text-red-400">
                  {result.totalSkipped}
                </p>
              </div>
            </div>

            {result.records.length > 0 && (
              <div className="max-h-[500px] overflow-auto rounded-xl border border-slate-700">
                <table className="min-w-max w-full text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-800">
                    <tr>
                      {resultColumns.map((column) => (
                        <th
                          key={column}
                          className="whitespace-nowrap border-b border-slate-700 px-4 py-4 font-semibold"
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {result.records.map((record, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className="border-b border-slate-800 hover:bg-slate-800/60"
                      >
                        {resultColumns.map((column) => (
                          <td
                            key={`${rowIndex}-${column}`}
                            className="max-w-xs whitespace-nowrap px-4 py-3 text-slate-300"
                          >
                            {String(record[column] || "—")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </section>
    </main>
  );
}