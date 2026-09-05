"use client";

import React, { useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";

export default function ProductCapture({ barcode, onSuccess }: { barcode?: string; onSuccess?: (barcode: string) => void }) {
  const { user } = useAuth();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setImagePreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFile = e.dataTransfer.files[0];
      setFile(selectedFile);
      setImagePreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleAnalyze = async () => {
    if (!file) return;

    try {
      setAnalyzing(true);
      setError(null);

      // We need to get the token if user is signed in
      const token = user ? await user.getIdToken() : null;
      if (!token) {
        throw new Error("You must be signed in to analyze images.");
      }

      const formData = new FormData();
      formData.append("image", file);
      if (barcode) {
        formData.append("barcode", barcode);
      }

      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const res = await fetch(`${API_URL}/api/products/analyze-image`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to analyze image");
      }

      const data = await res.json();
      console.log("Analysis Result:", data);
      
      // Clear after success or redirect
      if (onSuccess) {
        onSuccess(data.product.barcode);
      } else {
        alert("Product analyzed and saved successfully!");
        setImagePreview(null);
        setFile(null);
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div 
        className={`border-2 border-dashed rounded-3xl p-6 text-center transition-colors cursor-pointer ${imagePreview ? 'border-primary/50 bg-primary/5' : 'border-neutral-300 hover:border-primary/50'}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={!imagePreview ? triggerFileInput : undefined}
      >
        <input 
          type="file" 
          accept="image/*" 
          capture="environment"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />

        {imagePreview ? (
          <div className="space-y-4">
            <img 
              src={imagePreview} 
              alt="Preview" 
              className="max-h-64 mx-auto rounded-xl shadow-sm object-contain"
            />
            <button 
              onClick={() => { setFile(null); setImagePreview(null); }}
              className="text-sm text-tertiary hover:text-fg underline"
              disabled={analyzing}
            >
              Take another photo
            </button>
          </div>
        ) : (
          <div className="py-12 space-y-3">
            <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl text-neutral-500">photo_camera</span>
            </div>
            <p className="font-medium text-fg">Tap to scan a product</p>
            <p className="text-sm text-tertiary">or drag and drop a photo here</p>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm text-center">
          {error}
        </div>
      )}

      {imagePreview && (
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className={`w-full mt-6 py-4 px-6 rounded-2xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
            analyzing 
              ? 'bg-primary/70 cursor-not-allowed' 
              : 'bg-primary hover:bg-orange-600 hover:-translate-y-1 hover:shadow-orange-500/25'
          }`}
        >
          {analyzing ? (
            <>
              <span className="material-symbols-outlined animate-spin">sync</span>
              Analyzing with AI...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined">auto_awesome</span>
              Analyze with AI
            </>
          )}
        </button>
      )}
    </div>
  );
}
