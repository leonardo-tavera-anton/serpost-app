import { useEffect, useState } from "react";

interface ClientesViewProps {
  baseUrl: string;
  token: string;
}

interface Cliente {
  id?: string;
  tipo_documento: string;
  numero_documento: string;
  nombres: string;
  direccion: string;
  telefono: string;
  correo: string;
  rol: string;
}

interface ClienteFormState {
  tipo_documento: string;
  numero_documento: string;
  nombres: string;
  apellidos: string;
  direccion: string;
  telefono: string;
  correo: string;
  rol: string;
}

const EMPTY_FORM: ClienteFormState = {
  tipo_documento: "DNI",
  numero_documento: "",
  nombres: "",
  apellidos: "",
  direccion: "",
  telefono: "",
  correo: "",
  rol: "remitente",
};

function capitalizarPrimeraLetra(texto: string): string {
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto;
}

const BASURA_PATTERNS = [
  /^(.)\1+$/i,
  /qwerty/i,
  /asdf/i,
  /zxcv/i,
  /123456/,
  /abcdef/i,
  /prueba/i,
  /test/i,
  /xxxx/i,
  /aaaa/i,
  /sin\s*nombre/i,
  /no\s*tiene/i,
];

function esTextoBasura(valor: string): boolean {
  const limpio = valor.trim().toLowerCase();
  if (!limpio) return true;
  if (BASURA_PATTERNS.some((rx) => rx.test(limpio))) return true;
  const letras = limpio.replace(/[^a-zñáéíóú]/gi, "");
  if (letras.length >= 5 && !/[aeiouáéíóú]/i.test(letras)) {
    return true;
  }
  return false;
}

function esDireccionValida(dir: string): { ok: boolean; motivo?: string } {
  const clean = dir.trim();
  if (clean.length < 8 || clean.length > 20) {
    return { ok: false, motivo: "Dirección: debe tener entre 8 y 20 caracteres." };
  }
  if (!/^[a-zA-Z0-9ñÑáéíóúÁÉÍÓÚ\s.,#°/-]+$/.test(clean)) {
    return {
      ok: false,
      motivo: "Dirección: contiene caracteres no permitidos.",
    };
  }
  if (esTextoBasura(clean) || !/[a-zA-ZñÑáéíóúÁÉÍÓÚ]/.test(clean)) {
    return {
      ok: false,
      motivo: "Dirección: bloqueada por filtro antibasura (ingrese una dirección real).",
    };
  }
  return { ok: true };
}

function validarReglasCliente(f: ClienteFormState): string[] {
  const errores: string[] = [];

  const nom = f.nombres.trim();
  const ape = f.apellidos.trim();

  if (!nom || nom.length > 50 || !/^[a-zA-ZñÑáéíóúÁÉÍÓÚ\s]+$/.test(nom) || esTextoBasura(nom)) {
    errores.push("Nombres: obligatorio (máx. 50), solo letras y sin texto basura.");
  }
  if (!ape || ape.length > 50 || !/^[a-zA-ZñÑáéíóúÁÉÍÓÚ\s]+$/.test(ape) || esTextoBasura(ape)) {
    errores.push("Apellidos: obligatorio (máx. 50), solo letras y sin texto basura.");
  }

  const dirCheck = esDireccionValida(f.direccion);
  if (!dirCheck.ok && dirCheck.motivo) {
    errores.push(dirCheck.motivo);
  }

  if (!/^9\d{8}$/.test(f.telefono.trim())) {
    errores.push("Teléfono: debe tener exactamente 9 dígitos y empezar con 9.");
  }

  const correo = f.correo.trim();
  if (
    !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(correo) ||
    correo.length > 120
  ) {
    errores.push("Correo: formato inválido (ej. usuario@dominio.com) o supera 120 caracteres.");
  }

  const doc = f.numero_documento.trim();
  if (f.tipo_documento === "DNI" && !/^\d{8}$/.test(doc)) {
    errores.push("DNI: debe tener exactamente 8 dígitos.");
  } else if (f.tipo_documento === "RUC" && !/^\d{11}$/.test(doc)) {
    errores.push("RUC: debe tener exactamente 11 dígitos.");
  } else if (!doc || doc.length > 20) {
    errores.push("Número de documento: obligatorio y máximo 20 caracteres.");
  }

  return errores;
}

function separarNombreCompleto(fullName: string): { nombres: string; apellidos: string } {
  const partes = fullName.trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) {
    return { nombres: fullName.trim(), apellidos: "" };
  }
  if (partes.length === 2) {
    return { nombres: partes[0], apellidos: partes[1] };
  }
  const apellidos = partes.slice(-2).join(" ");
  const nombres = partes.slice(0, -2).join(" ");
  return { nombres, apellidos };
}

export function ClientesView({ baseUrl, token }: ClientesViewProps) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [form, setForm] = useState<ClienteFormState>(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [ruleWarnings, setRuleWarnings] = useState<string[]>([]);
  const [bypassRules, setBypassRules] = useState(false);

  async function cargarClientes() {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await window.serpostApi.request({
        baseUrl,
        token,
        path: "/clientes",
        method: "GET",
      });
      if (res.ok && Array.isArray(res.data)) {
        setClientes(res.data);
      } else {
        setErrorMsg(res.error || `Error GET /clientes (HTTP ${res.status})`);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error al cargar clientes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void cargarClientes();
  }, [baseUrl]);

  function handleChange(field: keyof ClienteFormState, value: string) {
    const next = { ...form, [field]: value };
    setForm(next);
    setRuleWarnings(validarReglasCliente(next));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg("");
    setErrorMsg("");

    const warnings = validarReglasCliente(form);
    setRuleWarnings(warnings);
    if (!bypassRules && warnings.length > 0) {
      setErrorMsg("Corrige las reglas o activa 'Enviar igual para probar respuesta del backend (400)'.");
      return;
    }

    const payload: Cliente = {
      tipo_documento: form.tipo_documento.trim(),
      numero_documento: form.numero_documento.trim(),
      nombres: `${form.nombres.trim()} ${form.apellidos.trim()}`.trim(),
      direccion: form.direccion.trim(),
      telefono: form.telefono.trim(),
      correo: form.correo.trim(),
      rol: form.rol,
    };

    setLoading(true);
    const isEdit = Boolean(editId);
    const res = await window.serpostApi.request({
      baseUrl,
      token,
      path: isEdit ? `/clientes/${encodeURIComponent(editId!)}` : "/clientes",
      method: isEdit ? "PUT" : "POST",
      body: payload,
    });
    setLoading(false);

    if (res.ok) {
      setStatusMsg(
        isEdit
          ? `Cliente actualizado (HTTP ${res.status}).`
          : `Cliente creado (HTTP ${res.status}).`
      );
      setForm(EMPTY_FORM);
      setEditId(null);
      setRuleWarnings([]);
      await cargarClientes();
    } else {
      setErrorMsg(`HTTP ${res.status}: ${res.error || "Error en la operación"}`);
    }
  }

  async function handleDelete(id?: string) {
    if (!id) return;
    setStatusMsg("");
    setErrorMsg("");
    setLoading(true);
    const res = await window.serpostApi.request({
      baseUrl,
      token,
      path: `/clientes/${encodeURIComponent(id)}`,
      method: "DELETE",
    });
    setLoading(false);

    if (res.ok) {
      setStatusMsg(`Cliente eliminado (HTTP ${res.status}).`);
      await cargarClientes();
    } else {
      setErrorMsg(`HTTP ${res.status}: ${res.error || "No se pudo eliminar"}`);
    }
  }

  function startEdit(c: Cliente) {
    const { nombres, apellidos } = separarNombreCompleto(c.nombres || "");
    const nextForm: ClienteFormState = {
      tipo_documento: c.tipo_documento || "DNI",
      numero_documento: c.numero_documento || "",
      nombres,
      apellidos,
      direccion: c.direccion || "",
      telefono: c.telefono || "",
      correo: c.correo || "",
      rol: c.rol || "remitente",
    };
    setEditId(c.id || null);
    setForm(nextForm);
    setRuleWarnings(validarReglasCliente(nextForm));
    setStatusMsg("");
    setErrorMsg("");
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Gestión CRUD + Reglas</p>
          <h1>Clientes ({clientes.length})</h1>
        </div>
        <button className="primary-button" type="button" onClick={() => void cargarClientes()} disabled={loading}>
          {loading ? "Cargando..." : "Actualizar lista (GET)"}
        </button>
      </div>

      {statusMsg && <div className="notice success">{statusMsg}</div>}
      {errorMsg && <div className="notice danger">{errorMsg}</div>}

      <form className="grid-form" onSubmit={(e) => void handleSubmit(e)}>
        <label>
          Tipo documento
          <select value={form.tipo_documento} onChange={(e) => handleChange("tipo_documento", e.target.value)}>
            <option value="DNI">DNI (8 dígitos)</option>
            <option value="RUC">RUC (11 dígitos)</option>
            <option value="CE">CE</option>
          </select>
        </label>

        <label>
          N° documento
          <input
            value={form.numero_documento}
            onChange={(e) => handleChange("numero_documento", e.target.value)}
            placeholder="44571480"
          />
        </label>

        <label>
          Nombres (solo letras)
          <input
            maxLength={50}
            value={form.nombres}
            onChange={(e) => handleChange("nombres", e.target.value)}
            placeholder="Ana Maria"
          />
        </label>

        <label>
          Apellidos (solo letras)
          <input
            maxLength={50}
            value={form.apellidos}
            onChange={(e) => handleChange("apellidos", e.target.value)}
            placeholder="Perez Quispe"
          />
        </label>

        <label>
          Teléfono (9 dígitos, inicia en 9)
          <input
            maxLength={15}
            value={form.telefono}
            onChange={(e) => handleChange("telefono", e.target.value)}
            placeholder="987654321"
          />
        </label>

        <label>
          Dirección (8 a 200 car., alfanumérico)
          <input
            maxLength={200}
            value={form.direccion}
            onChange={(e) => handleChange("direccion", e.target.value)}
            placeholder="Av Pacifico 123"
          />
        </label>

        <label>
          Correo electrónico
          <input
            type="email"
            value={form.correo}
            onChange={(e) => handleChange("correo", e.target.value)}
            placeholder="cliente@correo.com"
          />
        </label>

        <label>
          Rol
          <select value={form.rol} onChange={(e) => handleChange("rol", e.target.value)}>
            <option value="remitente">Remitente</option>
            <option value="destinatario">Destinatario</option>
          </select>
        </label>

        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={loading}>
            {editId ? "Guardar cambios (PUT)" : "Registrar cliente (POST)"}
          </button>
          {editId && (
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setEditId(null);
                setForm(EMPTY_FORM);
                setRuleWarnings([]);
              }}
            >
              Cancelar edición
            </button>
          )}
        </div>
      </form>

      <div className="rules-box">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={bypassRules}
            onChange={(e) => setBypassRules(e.target.checked)}
          />
          Enviar igual aunque falle una regla local (útil para probar respuestas 400 del backend)
        </label>
        {ruleWarnings.length > 0 && (
          <ul className="warnings-list">
            {ruleWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Documento</th>
              <th>Nombres y Apellidos</th>
              <th>Teléfono</th>
              <th>Dirección</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clientes.length === 0 ? (
              <tr>
                <td colSpan={8}>No hay clientes cargados o la lista está vacía.</td>
              </tr>
            ) : (
              clientes.map((c, idx) => (
                <tr key={c.id || idx}>
                  <td className="mono">{c.id ? `${c.id.slice(0, 8)}...` : "-"}</td>
                  <td>{c.tipo_documento} {c.numero_documento}</td>
                  <td>{c.nombres}</td>
                  <td>{c.telefono}</td>
                  <td>{c.direccion}</td>
                  <td>{c.correo}</td>
                  <td>{capitalizarPrimeraLetra(c.rol)}</td>
                  <td className="actions-cell">
                    <button type="button" className="edit-btn" onClick={() => startEdit(c)}>Editar</button>
                    <button type="button" className="danger-btn" onClick={() => void handleDelete(c.id)}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}