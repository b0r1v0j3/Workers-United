"use client";

import { useState } from "react";
import { ApplicationData, defaultApplicationData, ChildData } from "@/types/application";

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
            setMessage("✓ Podaci sačuvani!");
        } catch {
            setMessage("✗ Greška pri čuvanju");
        }
        setSaving(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            {/* Personal Data Section */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-[#dde3ec]">
                <h2 className="text-xl font-bold text-[#183b56] mb-6 flex items-center gap-2">
                    👤 Lični podaci
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-[#64748b] mb-1">Prezime *</label>
                        <input
                            type="text"
                            value={data.personal.surname}
                            onChange={(e) => updatePersonal("surname", e.target.value)}
                            className="w-full border border-[#dde3ec] rounded-lg px-4 py-2"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#64748b] mb-1">Prezime pri rođenju</label>
                        <input
                            type="text"
                            value={data.personal.surname_at_birth}
                            onChange={(e) => updatePersonal("surname_at_birth", e.target.value)}
                            className="w-full border border-[#dde3ec] rounded-lg px-4 py-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#64748b] mb-1">Ime *</label>
                        <input
                            type="text"
                            value={data.personal.first_name}
                            onChange={(e) => updatePersonal("first_name", e.target.value)}
                            className="w-full border border-[#dde3ec] rounded-lg px-4 py-2"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#64748b] mb-1">Pol *</label>
                        <select
                            value={data.personal.gender}
                            onChange={(e) => updatePersonal("gender", e.target.value)}
                            className="w-full border border-[#dde3ec] rounded-lg px-4 py-2 bg-white"
                            required
                        >
                            <option value="male">Muški</option>
                            <option value="female">Ženski</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#64748b] mb-1">Datum rođenja *</label>
                        <input
                            type="date"
                            value={data.personal.date_of_birth}
                            onChange={(e) => updatePersonal("date_of_birth", e.target.value)}
                            className="w-full border border-[#dde3ec] rounded-lg px-4 py-2"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#64748b] mb-1">Država rođenja *</label>
                        <input
                            type="text"
                            value={data.personal.country_of_birth}
                            onChange={(e) => updatePersonal("country_of_birth", e.target.value)}
                            className="w-full border border-[#dde3ec] rounded-lg px-4 py-2"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#64748b] mb-1">Mesto rođenja *</label>
                        <input
                            type="text"
                            value={data.personal.city_of_birth}
                            onChange={(e) => updatePersonal("city_of_birth", e.target.value)}
                            className="w-full border border-[#dde3ec] rounded-lg px-4 py-2"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#64748b] mb-1">Državljanstvo *</label>
                        <input
                            type="text"
                            value={data.personal.citizenship}
                            onChange={(e) => updatePersonal("citizenship", e.target.value)}
                            className="w-full border border-[#dde3ec] rounded-lg px-4 py-2"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#64748b] mb-1">Prvobitno državljanstvo</label>
                        <input
                            type="text"
                            value={data.personal.original_citizenship}
                            onChange={(e) => updatePersonal("original_citizenship", e.target.value)}
                            className="w-full border border-[#dde3ec] rounded-lg px-4 py-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#64748b] mb-1">Bračni status *</label>
                        <select
                            value={data.personal.marital_status}
                            onChange={(e) => updatePersonal("marital_status", e.target.value)}
                            className="w-full border border-[#dde3ec] rounded-lg px-4 py-2 bg-white"
                            required
                        >
                            <option value="neozenjenneudata">Neoženjen/Neudata</option>
                            <option value="ozenjenudata">Oženjen/udata</option>
                            <option value="razdvojen">Razdvojen/a</option>
                            <option value="razveden">Razveden/a</option>
                            <option value="udovac">Udovac/Udovica</option>
                            <option value="drugo">Drugo</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#64748b] mb-1">Ime oca *</label>
                        <input
                            type="text"
                            value={data.personal.father_name}
                            onChange={(e) => updatePersonal("father_name", e.target.value)}
                            className="w-full border border-[#dde3ec] rounded-lg px-4 py-2"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[#64748b] mb-1">Ime majke *</label>
                        <input
                            type="text"
                            value={data.personal.mother_name}
                            onChange={(e) => updatePersonal("mother_name", e.target.value)}
                            className="w-full border border-[#dde3ec] rounded-lg px-4 py-2"
                            required
                        />
                    </div>
                </div>
            </div>

            {/* Family Section */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-[#dde3ec]">
                <h2 className="text-xl font-bold text-[#183b56] mb-6 flex items-center gap-2">
                    👨‍👩‍👧 Podaci o porodici
                </h2>

                <div className="mb-6">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={data.family.has_family}
                            onChange={(e) => setData(prev => ({
                                ...prev,
                                family: {
                                    ...prev.family,
                                    has_family: e.target.checked,
                                    spouse: e.target.checked ? { surname: "", surname_at_birth: "", first_name: "", date_of_birth: "", country_of_birth: "", city_of_birth: "" } : undefined
                                }
                            }))}
                            className="w-5 h-5 rounded border-gray-300"
                        />
                        <span className="font-medium">Imam supružnika</span>
                    </label>
                </div>

                {data.family.has_family && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-[#f8fafc] rounded-lg">
                        <h3 className="col-span-full font-semibold text-[#183b56]">Podaci o supružniku</h3>
                        <div>
                            <label className="block text-sm font-medium text-[#64748b] mb-1">Prezime supružnika</label>
                            <input
                                type="text"
                                value={data.family.spouse?.surname || ""}
                                onChange={(e) => updateSpouse("surname", e.target.value)}
                                className="w-full border border-[#dde3ec] rounded-lg px-4 py-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[#64748b] mb-1">Prezime pri rođenju</label>
                            <input
                                type="text"
                                value={data.family.spouse?.surname_at_birth || ""}
                                onChange={(e) => updateSpouse("surname_at_birth", e.target.value)}
                                className="w-full border border-[#dde3ec] rounded-lg px-4 py-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[#64748b] mb-1">Ime supružnika</label>
                            <input
                                type="text"
                                value={data.family.spouse?.first_name || ""}
                                onChange={(e) => updateSpouse("first_name", e.target.value)}
                                className="w-full border border-[#dde3ec] rounded-lg px-4 py-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[#64748b] mb-1">Datum rođenja</label>
                            <input
                                type="date"
                                value={data.family.spouse?.date_of_birth || ""}
                                onChange={(e) => updateSpouse("date_of_birth", e.target.value)}
                                className="w-full border border-[#dde3ec] rounded-lg px-4 py-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[#64748b] mb-1">Država rođenja</label>
                            <input
                                type="text"
                                value={data.family.spouse?.country_of_birth || ""}
                                onChange={(e) => updateSpouse("country_of_birth", e.target.value)}
                                className="w-full border border-[#dde3ec] rounded-lg px-4 py-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[#64748b] mb-1">Mesto rođenja</label>
                            <input
                                type="text"
                                value={data.family.spouse?.city_of_birth || ""}
                                onChange={(e) => updateSpouse("city_of_birth", e.target.value)}
                                className="w-full border border-[#dde3ec] rounded-lg px-4 py-2"
                            />
                        </div>
                    </div>
                )}

                <div className="mb-6">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={data.family.has_children}
                            onChange={(e) => setData(prev => ({
                                ...prev,
                                family: { ...prev.family, has_children: e.target.checked }
                            }))}
                            className="w-5 h-5 rounded border-gray-300"
                        />
                        <span className="font-medium">Imam decu</span>
                    </label>
                </div>

                {data.family.has_children && (
                    <div className="space-y-4">
                        {data.family.children.map((child, index) => (
                            <div key={index} className="p-4 bg-[#f8fafc] rounded-lg border border-[#dde3ec]">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="font-semibold text-[#183b56]">Dete {index + 1}</h4>
                                    <button
                                        type="button"
                                        onClick={() => removeChild(index)}
                                        className="text-red-500 text-sm hover:underline"
                                    >
                                        Ukloni
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-[#64748b] mb-1">Prezime</label>
                                        <input
                                            type="text"
                                            value={child.surname}
                                            onChange={(e) => updateChild(index, "surname", e.target.value)}
                                            className="w-full border border-[#dde3ec] rounded-lg px-4 py-2"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[#64748b] mb-1">Ime</label>
                                        <input
                                            type="text"
                                            value={child.first_name}
                                            onChange={(e) => updateChild(index, "first_name", e.target.value)}
                                            className="w-full border border-[#dde3ec] rounded-lg px-4 py-2"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[#64748b] mb-1">Datum rođenja</label>
                                        <input
                                            type="date"
                                            value={child.date_of_birth}
                                            onChange={(e) => updateChild(index, "date_of_birth", e.target.value)}
                                            className="w-full border border-[#dde3ec] rounded-lg px-4 py-2"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                        {data.family.children.length < 5 && (
                            <button
                                type="button"
                                onClick={addChild}
                                className="text-[#2f6fed] font-semibold text-sm hover:underline"
                            >
                                + Dodaj dete
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Submit */}
            <div className="flex items-center gap-4">
                <button
                    type="submit"
                    disabled={saving}
                    className="bg-[#2f6fed] text-white px-8 py-3 rounded-lg font-bold hover:bg-[#1e5cd6] transition-colors disabled:opacity-50"
                >
                    {saving ? "Čuvanje..." : "Sačuvaj podatke"}
                </button>
                {message && (
                    <span className={message.includes("✓") ? "text-green-600" : "text-red-600"}>
                        {message}
                    </span>
                )}
            </div>
        </form>
    );
}
