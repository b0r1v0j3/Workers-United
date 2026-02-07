"use client";

import { useState } from "react";
import { ApplicationData, defaultApplicationData } from "@/types/application";
import {
    User,
    Calendar,
    MapPin,
    Flag,
    Users,
    Heart,
    Plus,
    Trash2,
    Save,
    CheckCircle2,
    AlertCircle
} from "lucide-react";

interface ApplicationDataFormProps {
    initialData?: ApplicationData;
    onSave: (data: ApplicationData) => Promise<void>;
}

export default function ApplicationDataForm({ initialData, onSave }: ApplicationDataFormProps) {
    const [data, setData] = useState<ApplicationData>(initialData || defaultApplicationData);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");

    const updatePersonal = (field: string, value: string | boolean) => {
        setData(prev => ({
            ...prev,
            personal: { ...prev.personal, [field]: value }
        }));
    };

    const updateSpouse = (field: string, value: string) => {
        setData(prev => ({
            ...prev,
            family: {
                ...prev.family,
                spouse: { ...prev.family.spouse!, [field]: value }
            }
        }));
    };

    const updateChild = (index: number, field: string, value: string) => {
        setData(prev => {
            const children = [...prev.family.children];
            children[index] = { ...children[index], [field]: value };
            return {
                ...prev,
                family: { ...prev.family, children }
            };
        });
    };

    const addChild = () => {
        if (data.family.children.length >= 5) return;
        setData(prev => ({
            ...prev,
            family: {
                ...prev.family,
                children: [...prev.family.children, { surname: "", first_name: "", date_of_birth: "" }]
            }
        }));
    };

    const removeChild = (index: number) => {
        setData(prev => ({
            ...prev,
            family: {
                ...prev.family,
                children: prev.family.children.filter((_, i) => i !== index)
            }
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage("");
        try {
            await onSave(data);
            setMessage("✓ Podaci uspešno sačuvani!");
            setTimeout(() => setMessage(""), 3000);
        } catch {
            setMessage("✗ Greška pri čuvanju podataka");
        }
        setSaving(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8 max-w-5xl mx-auto">
            {/* Personal Data Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50/50 px-8 py-6 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                            <User size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Lični Podaci</h2>
                            <p className="text-slate-500 text-sm mt-1">Osnovne informacije o kandidatu</p>
                        </div>
                    </div>
                </div>

                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <InputField
                        label="Prezime"
                        value={data.personal.surname}
                        onChange={(v) => updatePersonal("surname", v)}
                        required
                        icon={<User size={16} />}
                    />
                    <InputField
                        label="Prezime pri rođenju"
                        value={data.personal.surname_at_birth}
                        onChange={(v) => updatePersonal("surname_at_birth", v)}
                    />
                    <InputField
                        label="Ime"
                        value={data.personal.first_name}
                        onChange={(v) => updatePersonal("first_name", v)}
                        required
                        icon={<User size={16} />}
                    />

                    <div className="space-y-1.5">
                        <label className="block text-sm font-semibold text-slate-700">Pol <span className="text-red-500">*</span></label>
                        <div className="relative">
                            <select
                                value={data.personal.gender}
                                onChange={(e) => updatePersonal("gender", e.target.value)}
                                className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none appearance-none font-medium text-slate-700"
                                required
                            >
                                <option value="male">Muški</option>
                                <option value="female">Ženski</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                <User size={16} />
                            </div>
                        </div>
                    </div>

                    <InputField
                        label="Datum rođenja"
                        type="date"
                        value={data.personal.date_of_birth}
                        onChange={(v) => updatePersonal("date_of_birth", v)}
                        required
                        icon={<Calendar size={16} />}
                    />
                    <InputField
                        label="Država rođenja"
                        value={data.personal.country_of_birth}
                        onChange={(v) => updatePersonal("country_of_birth", v)}
                        required
                        icon={<Flag size={16} />}
                    />
                    <InputField
                        label="Mesto rođenja"
                        value={data.personal.city_of_birth}
                        onChange={(v) => updatePersonal("city_of_birth", v)}
                        required
                        icon={<MapPin size={16} />}
                    />
                    <InputField
                        label="Državljanstvo"
                        value={data.personal.citizenship}
                        onChange={(v) => updatePersonal("citizenship", v)}
                        required
                        icon={<Flag size={16} />}
                    />
                    <InputField
                        label="Prvobitno državljanstvo"
                        value={data.personal.original_citizenship}
                        onChange={(v) => updatePersonal("original_citizenship", v)}
                        icon={<Flag size={16} />}
                    />

                    <div className="space-y-1.5">
                        <label className="block text-sm font-semibold text-slate-700">Bračni status <span className="text-red-500">*</span></label>
                        <div className="relative">
                            <select
                                value={data.personal.marital_status}
                                onChange={(e) => updatePersonal("marital_status", e.target.value)}
                                className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none appearance-none font-medium text-slate-700"
                                required
                            >
                                <option value="neozenjenneudata">Neoženjen/Neudata</option>
                                <option value="ozenjenudata">Oženjen/udata</option>
                                <option value="razdvojen">Razdvojen/a</option>
                                <option value="razveden">Razveden/a</option>
                                <option value="udovac">Udovac/Udovica</option>
                                <option value="drugo">Drugo</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                <Heart size={16} />
                            </div>
                        </div>
                    </div>

                    <InputField
                        label="Ime oca"
                        value={data.personal.father_name}
                        onChange={(v) => updatePersonal("father_name", v)}
                        required
                        icon={<User size={16} />}
                    />
                    <InputField
                        label="Ime majke"
                        value={data.personal.mother_name}
                        onChange={(v) => updatePersonal("mother_name", v)}
                        required
                        icon={<User size={16} />}
                    />
                </div>
            </div>

            {/* Family Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50/50 px-8 py-6 border-b border-slate-100 flex justify-between items-center flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                            <Users size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Podaci o Porodici</h2>
                            <p className="text-slate-500 text-sm mt-1">Supružnik i deca</p>
                        </div>
                    </div>
                </div>

                <div className="p-8 space-y-8">
                    {/* Spouse Toggle */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                        onClick={() => setData(prev => ({
                            ...prev,
                            family: {
                                ...prev.family,
                                has_family: !prev.family.has_family,
                                spouse: !prev.family.has_family ? { surname: "", surname_at_birth: "", first_name: "", date_of_birth: "", country_of_birth: "", city_of_birth: "" } : undefined
                            }
                        }))}>
                        <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${data.family.has_family ? 'bg-blue-500 border-blue-500' : 'border-slate-300 bg-white'}`}>
                                {data.family.has_family && <CheckCircle2 size={14} className="text-white" />}
                            </div>
                            <span className="font-semibold text-slate-700">Imam supružnika</span>
                        </div>
                    </div>

                    {data.family.has_family && (
                        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 pl-1">Podaci o supružniku</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 bg-slate-50 rounded-xl border border-slate-200">
                                <InputField label="Prezime supružnika" value={data.family.spouse?.surname || ""} onChange={(v) => updateSpouse("surname", v)} />
                                <InputField label="Prezime pri rođenju" value={data.family.spouse?.surname_at_birth || ""} onChange={(v) => updateSpouse("surname_at_birth", v)} />
                                <InputField label="Ime supružnika" value={data.family.spouse?.first_name || ""} onChange={(v) => updateSpouse("first_name", v)} />
                                <InputField label="Datum rođenja" type="date" value={data.family.spouse?.date_of_birth || ""} onChange={(v) => updateSpouse("date_of_birth", v)} />
                                <InputField label="Država rođenja" value={data.family.spouse?.country_of_birth || ""} onChange={(v) => updateSpouse("country_of_birth", v)} />
                                <InputField label="Mesto rođenja" value={data.family.spouse?.city_of_birth || ""} onChange={(v) => updateSpouse("city_of_birth", v)} />
                            </div>
                        </div>
                    )}

                    <div className="h-px bg-slate-100" />

                    {/* Children Toggle */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                        onClick={() => setData(prev => ({
                            ...prev,
                            family: { ...prev.family, has_children: !prev.family.has_children }
                        }))}>
                        <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${data.family.has_children ? 'bg-blue-500 border-blue-500' : 'border-slate-300 bg-white'}`}>
                                {data.family.has_children && <CheckCircle2 size={14} className="text-white" />}
                            </div>
                            <span className="font-semibold text-slate-700">Imam decu</span>
                        </div>
                    </div>

                    {data.family.has_children && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider pl-1">Podaci o deci</h3>

                            {data.family.children.map((child, index) => (
                                <div key={index} className="group relative p-6 bg-slate-50 rounded-xl border border-slate-200 hover:border-blue-200 hover:shadow-md transition-all">
                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            type="button"
                                            onClick={() => removeChild(index)}
                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Ukloni dete"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>

                                    <h4 className="font-semibold text-blue-900 mb-4 flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">
                                            {index + 1}
                                        </div>
                                        Dete
                                    </h4>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="md:col-span-1">
                                            <InputField label="Prezime" value={child.surname} onChange={(v) => updateChild(index, "surname", v)} small />
                                        </div>
                                        <div className="md:col-span-1">
                                            <InputField label="Ime" value={child.first_name} onChange={(v) => updateChild(index, "first_name", v)} small />
                                        </div>
                                        <div className="md:col-span-1">
                                            <InputField label="Datum rođenja" type="date" value={child.date_of_birth} onChange={(v) => updateChild(index, "date_of_birth", v)} small />
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {data.family.children.length < 5 && (
                                <button
                                    type="button"
                                    onClick={addChild}
                                    className="w-full py-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-medium hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-all flex items-center justify-center gap-2"
                                >
                                    <Plus size={20} />
                                    Dodaj još jedno dete
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Submit Action Bar */}
            <div className="sticky bottom-6 z-40 bg-white/80 backdrop-blur-md border border-slate-200 p-4 rounded-2xl shadow-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {message && (
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium animate-in fade-in slide-in-from-bottom-2 ${message.includes("✓") ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                            }`}>
                            {message.includes("✓") ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                            {message}
                        </div>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={saving}
                    className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
                >
                    {saving ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Čuvanje...
                        </>
                    ) : (
                        <>
                            <Save size={18} />
                            Sačuvaj izmene
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}

// Reusable Components
function InputField({ label, value, onChange, type = "text", required, icon, small }: {
    label: string,
    value: string,
    onChange: (val: string) => void,
    type?: string,
    required?: boolean,
    icon?: React.ReactNode,
    small?: boolean
}) {
    return (
        <div className="space-y-1.5 group">
            <label className={`block font-semibold text-slate-700 transition-colors group-focus-within:text-blue-600 ${small ? 'text-xs uppercase tracking-wide' : 'text-sm'}`}>
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
                <input
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={`w-full ${icon ? 'pl-4 pr-10' : 'px-4'} py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none font-medium text-slate-800 placeholder:text-slate-400`}
                    required={required}
                />
                {icon && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
                        {icon}
                    </div>
                )}
            </div>
        </div>
    );
}

