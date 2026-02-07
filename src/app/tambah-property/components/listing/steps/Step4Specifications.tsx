'use client';

import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { ListingFormData } from '@/lib/validations/listing';
import { FormField } from '../FormField';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { motion } from 'framer-motion';
import { 
  SERTIFIKAT_OPTIONS, 
  HADAP_OPTIONS, 
  SUMBER_AIR_OPTIONS, 
  KONDISI_INTERIOR_OPTIONS 
} from '@/app/tambah-property/types/listing';
import { 
  Square, 
  Home, 
  Bed, 
  Bath, 
  Layers, 
  Zap, 
  Droplets, 
  Compass,
  Sofa,
  FileText
} from 'lucide-react';

interface Step4Props {
  form: UseFormReturn<ListingFormData>;
}

interface SpecInputProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}

function SpecInput({ icon, label, children }: SpecInputProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-medium text-slate-300">{label}</span>
      </div>
      {children}
    </div>
  );
}

export function Step4Specifications({ form }: Step4Props) {
  const { watch, formState: { errors } } = form;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-100 mb-2">
          Spesifikasi Property
        </h2>
        <p className="text-slate-400">
          Detail spesifikasi membantu calon pembeli memahami property lebih baik
        </p>
      </div>

      {/* Dimensi Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <Square className="h-5 w-5 text-indigo-400" />
          Dimensi Property
        </h3>
        
        <div className="grid grid-cols-3 gap-4">
          <FormField
            label="Luas Tanah (m²)"
            error={errors.luas_tanah?.message}
          >
            <Input
              type="number"
              step="0.01"
              {...form.register('luas_tanah', { valueAsNumber: true })}
              placeholder="200"
            />
          </FormField>

          <FormField
            label="Luas Bangunan (m²)"
            error={errors.luas_bangunan?.message}
          >
            <Input
              type="number"
              step="0.01"
              {...form.register('luas_bangunan', { valueAsNumber: true })}
              placeholder="150"
            />
          </FormField>

          <FormField
            label="Jumlah Lantai"
            error={errors.jumlah_lantai?.message}
          >
            <Input
              type="number"
              {...form.register('jumlah_lantai', { valueAsNumber: true })}
              placeholder="2"
              min="1"
            />
          </FormField>
        </div>

        {/* Visual Area Comparison */}
        {watch('luas_tanah') && watch('luas_bangunan') && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 bg-slate-800 rounded-lg border border-slate-700"
          >
            <div className="flex items-center justify-between text-sm">
              <div>
                <span className="text-slate-400">Rasio Bangunan/Tanah:</span>
                <span className="ml-2 font-semibold text-indigo-400">
                  {((watch('luas_bangunan') / watch('luas_tanah')) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-20 h-4 bg-slate-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ 
                      width: `${Math.min((watch('luas_bangunan') / watch('luas_tanah')) * 100, 100)}%` 
                    }}
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Struktur Bangunan Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <Home className="h-5 w-5 text-indigo-400" />
          Struktur Bangunan
        </h3>

        <div className="grid grid-cols-4 gap-4">
          <SpecInput
            icon={<Bed className="h-4 w-4 text-slate-400" />}
            label="Kamar Tidur"
          >
            <Input
              type="number"
              {...form.register('kamar_tidur', { valueAsNumber: true })}
              placeholder="4"
              min="0"
            />
          </SpecInput>

          <SpecInput
            icon={<Bath className="h-4 w-4 text-slate-400" />}
            label="Kamar Mandi"
          >
            <Input
              type="number"
              {...form.register('kamar_mandi', { valueAsNumber: true })}
              placeholder="3"
              min="0"
            />
          </SpecInput>

          <SpecInput
            icon={<Layers className="h-4 w-4 text-slate-400" />}
            label="Lantai"
          >
            <Input
              type="number"
              {...form.register('jumlah_lantai', { valueAsNumber: true })}
              placeholder="2"
              min="1"
            />
          </SpecInput>

          <SpecInput
            icon={<Zap className="h-4 w-4 text-slate-400" />}
            label="Daya Listrik (VA)"
          >
            <Input
              type="number"
              {...form.register('daya_listrik', { valueAsNumber: true })}
              placeholder="2200"
              min="0"
            />
          </SpecInput>
        </div>
      </div>

      {/* Detail Tambahan Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <Compass className="h-5 w-5 text-indigo-400" />
          Detail Tambahan
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <SpecInput
            icon={<Compass className="h-4 w-4 text-slate-400" />}
            label="Hadap Bangunan"
          >
            <Select {...form.register('hadap_bangunan')}>
              <option value="">Pilih Arah</option>
              {HADAP_OPTIONS.map((hadap) => (
                <option key={hadap} value={hadap}>
                  {hadap}
                </option>
              ))}
            </Select>
          </SpecInput>

          <SpecInput
            icon={<Droplets className="h-4 w-4 text-slate-400" />}
            label="Sumber Air"
          >
            <Select {...form.register('sumber_air')}>
              <option value="">Pilih Sumber Air</option>
              {SUMBER_AIR_OPTIONS.map((air) => (
                <option key={air} value={air}>
                  {air}
                </option>
              ))}
            </Select>
          </SpecInput>
        </div>

        <SpecInput
          icon={<Sofa className="h-4 w-4 text-slate-400" />}
          label="Kondisi Interior"
        >
          <Select {...form.register('kondisi_interior')}>
            <option value="">Pilih Kondisi</option>
            {KONDISI_INTERIOR_OPTIONS.map((kondisi) => (
              <option key={kondisi} value={kondisi}>
                {kondisi}
              </option>
            ))}
          </Select>
        </SpecInput>
      </div>

      {/* Legalitas Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <FileText className="h-5 w-5 text-indigo-400" />
          Legalitas Property
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Jenis Sertifikat"
            error={errors.legalitas?.message}
          >
            <Select {...form.register('legalitas')}>
              <option value="">Pilih Sertifikat</option>
              {SERTIFIKAT_OPTIONS.map((sert) => (
                <option key={sert.value} value={sert.value}>
                  {sert.label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label="Nomor Sertifikat"
            error={errors.nomor_legalitas?.message}
            hint="Nomor sertifikat atau dokumen legalitas"
          >
            <Input
              {...form.register('nomor_legalitas')}
              placeholder="12345/2023"
            />
          </FormField>
        </div>
      </div>

      {/* Summary Card */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-6 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-xl"
      >
        <h4 className="text-sm font-semibold text-indigo-400 mb-4 flex items-center gap-2">
          <span>📋</span>
          <span>Ringkasan Spesifikasi</span>
        </h4>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {watch('luas_tanah') && (
            <div className="text-center p-3 bg-slate-800/50 rounded-lg">
              <Square className="h-5 w-5 text-slate-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-slate-100">{watch('luas_tanah')}m²</p>
              <p className="text-xs text-slate-400">Luas Tanah</p>
            </div>
          )}
          
          {watch('luas_bangunan') && (
            <div className="text-center p-3 bg-slate-800/50 rounded-lg">
              <Home className="h-5 w-5 text-slate-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-slate-100">{watch('luas_bangunan')}m²</p>
              <p className="text-xs text-slate-400">Luas Bangunan</p>
            </div>
          )}
          
          {watch('kamar_tidur') && (
            <div className="text-center p-3 bg-slate-800/50 rounded-lg">
              <Bed className="h-5 w-5 text-slate-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-slate-100">{watch('kamar_tidur')}</p>
              <p className="text-xs text-slate-400">K. Tidur</p>
            </div>
          )}
          
          {watch('kamar_mandi') && (
            <div className="text-center p-3 bg-slate-800/50 rounded-lg">
              <Bath className="h-5 w-5 text-slate-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-slate-100">{watch('kamar_mandi')}</p>
              <p className="text-xs text-slate-400">K. Mandi</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Tips Card */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg"
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <h4 className="text-sm font-semibold text-blue-400 mb-1">
              Tips Spesifikasi
            </h4>
            <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
              <li>Pastikan semua ukuran akurat dan terverifikasi</li>
              <li>Sertifikat yang jelas meningkatkan kepercayaan buyer</li>
              <li>Detail lengkap dapat meningkatkan inquiry hingga 60%</li>
            </ul>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
