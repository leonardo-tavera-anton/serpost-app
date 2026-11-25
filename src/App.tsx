import { useEffect, useState } from "react";
import {
  getSavedBackendUrl,
  getSavedToken,
  saveBackendToken,
  saveBackendUrl,
} from "./config/backend";
import { BoletaDoc, type DatosCotizacion } from "./components/BoletaDoc";
import { GuiaSeguimientoDoc } from "./components/GuiaSeguimientoDoc";
import { ClientesView } from "./views/ClientesView";
import { EnviosView } from "./views/EnviosView";
import { OperacionesView } from "./views/OperacionesView";
import { TarifaView } from "./views/TarifaView";

interface ApiResponse {
  ok: boolean;
  status: number;
  data: unknown;
  error: string | null;
}

interface BackendTestResult {
  name: string;
  description: string;
  passed: boolean;
  status: number | null;
  durationMs: number;
  expected: string;
  response: string;
}

type ActiveTab =
  | "clientes"
  | "envios"
  | "tarifa"
  | "boleta"
  | "guia"
  | "operaciones"
  | "pruebas";

function generarUuidAleatorio(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const hex = Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function resumenRespuesta(status: number | null, passed: boolean): string {
  if (!passed) return "No coincide con el estado HTTP esperado.";
  if (status === 404) return "Respuesta 404 esperada: el UUID aleatorio no existe.";
  if (status === 409) return "Respuesta 409 esperada: el backend bloqueó el documento duplicado.";
  if (status === 400) return "Respuesta 400 esperada: el backend validó los campos obligatorios.";
  return "Respuesta correcta del backend.";
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("clientes");
  const [baseUrl, setBaseUrl] = useState<string>(() => getSavedBackendUrl());
  const [token, setToken] = useState<string>(() => getSavedToken());
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);

  // Estado compartido para Boleta y Guía
  const [cotizacionActual, setCotizacionActual] = useState<DatosCotizacion | null>(null);
  const [guiaHabilitada, setGuiaHabilitada] = useState<boolean>(false);

  const [testsRunning, setTestsRunning] = useState<boolean>(false);
  const [testResults, setTestResults] = useState<BackendTestResult[]>([]);

  useEffect(() => {
    saveBackendUrl(baseUrl);
  }, [baseUrl]);

  useEffect(() => {
    saveBackendToken(token);
  }, [token]);

  async function ejecutarPrueba(
    name: string,
    description: string,
    expected: string,
    operation: () => Promise<ApiResponse>,
  ): Promise<BackendTestResult> {
    const startedAt = performance.now();
    try {
      const response = await operation();
      const passed = response.status !== 0 && expected === String(response.status);
      const durationMs = Math.round(performance.now() - startedAt);
      let responseText = "";
      if (typeof response.data === "string") {
        responseText = response.data;
      } else if (response.data !== null && response.data !== undefined) {
        responseText = JSON.stringify(response.data, null, 2);
      } else {
        responseText = response.error || "Sin cuerpo de respuesta";
      }

      return {
        name,
        description,
        passed,
        status: response.status || null,
        durationMs,
        expected,
        response: responseText,
      };
    } catch (caught) {
      return {
        name,
        description,
        passed: false,
        status: null,
        durationMs: Math.round(performance.now() - startedAt),
        expected,
        response: caught instanceof Error ? caught.message : "La prueba produjo un error.",
      };
    }
  }

  async function ejecutarPruebasBackend() {
    setTestsRunning(true);
    setTestResults([]);
    const results: BackendTestResult[] = [];
    const registrar = (item: BackendTestResult) => {
      results.push(item);
      setTestResults([...results]);
    };

    const uuidPrueba = generarUuidAleatorio();

    registrar(
      await ejecutarPrueba(
        "Cliente inexistente (UUID)",
        "GET con UUID aleatorio inexistente devuelve 404 controlado.",
        "404",
        () =>
          window.serpostApi.request({
            baseUrl,
            token: "",
            path: `/clientes/${uuidPrueba}`,
            method: "GET",
          }),
      ),
    );

    const suffix = String(Date.now()).slice(-6);
    const clientePrueba = {
      tipo_documento: "DNI",
      numero_documento: `44${suffix}`,
      nombres: "Ana Perez Prueba",
      direccion: "Calle Principal 123",
      telefono: "912345678",
      correo: `ana.${suffix}@example.com`,
      rol: "remitente",
    };

    const registro = await ejecutarPrueba(
      "Registrar cliente",
      "POST /clientes debe crear un cliente y devolver 201.",
      "201",
      () =>
        window.serpostApi.request({
          baseUrl,
          token,
          path: "/clientes",
          method: "POST",
          body: clientePrueba,
        }),
    );
    registrar(registro);

    let idCliente = "";
    if (registro.status === 201) {
      try {
        const parsed = JSON.parse(registro.response);
        idCliente = parsed?.id ? String(parsed.id) : "";
      } catch {
        const match =
          /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[a-zA-Z0-9_-]+)/i.exec(
            registro.response,
          );
        idCliente = match?.[1] || "";
      }

      if (idCliente) {
        registrar(
          await ejecutarPrueba(
            "Consultar cliente",
            "GET /clientes/{id_cliente} debe devolver los datos registrados.",
            "200",
            () =>
              window.serpostApi.request({
                baseUrl,
                token,
                path: `/clientes/${encodeURIComponent(idCliente)}`,
                method: "GET",
              }),
          ),
        );

        registrar(
          await ejecutarPrueba(
            "Actualizar cliente",
            "PUT /clientes/{id_cliente} debe actualizar los datos.",
            "200",
            () =>
              window.serpostApi.request({
                baseUrl,
                token,
                path: `/clientes/${encodeURIComponent(idCliente)}`,
                method: "PUT",
                body: { ...clientePrueba, nombres: "Ana Perez Actualizada" },
              }),
          ),
        );
      }
    }

    registrar(
      await ejecutarPrueba(
        "Documento duplicado",
        "Registrar dos veces el mismo documento debe devolver 409.",
        "409",
        () =>
          window.serpostApi.request({
            baseUrl,
            token,
            path: "/clientes",
            method: "POST",
            body: clientePrueba,
          }),
      ),
    );

    registrar(
      await ejecutarPrueba(
        "Validacion de campos",
        "POST sin datos obligatorios debe devolver 400.",
        "400",
        () =>
          window.serpostApi.request({
            baseUrl,
            token,
            path: "/clientes",
            method: "POST",
            body: {},
          }),
      ),
    );

    setTestsRunning(false);
  }

  const passedCount = testResults.filter((item) => item.passed).length;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img
            className="brand-logo"
            src="./imagenes/logo-serpost.png"
            alt="Serpost - El Correo del Perú"
          />
        </div>

        <div className="header-actions">
          <nav className="app-nav">
            <button
              type="button"
              className={`nav-button ${activeTab === "clientes" ? "active" : ""}`}
              onClick={() => setActiveTab("clientes")}
            >
              Clientes
            </button>
            <button
              type="button"
              className={`nav-button ${activeTab === "envios" ? "active" : ""}`}
              onClick={() => setActiveTab("envios")}
            >
              Envios
            </button>
            <button
              type="button"
              className={`nav-button ${activeTab === "tarifa" ? "active" : ""}`}
              onClick={() => setActiveTab("tarifa")}
            >
              Tarifa
            </button>
            <button
              type="button"
              className={`nav-button ${activeTab === "boleta" ? "active" : ""}`}
              onClick={() => setActiveTab("boleta")}
            >
              Boleta
            </button>
            <button
              type="button"
              className={`nav-button ${activeTab === "guia" ? "active" : ""}`}
              onClick={() => setActiveTab("guia")}
            >
              Guia
            </button>
            <button
              type="button"
              className={`nav-button ${activeTab === "operaciones" ? "active" : ""}`}
              onClick={() => setActiveTab("operaciones")}
            >
              Endpoints y Reglas
            </button>
            <button
              type="button"
              className={`nav-button ${activeTab === "pruebas" ? "active" : ""}`}
              onClick={() => setActiveTab("pruebas")}
            >
              Pruebas del backend
            </button>
          </nav>

          <button
            type="button"
            className="settings-button"
            onClick={() => setSettingsOpen(true)}
          >
            Configuracion
          </button>
        </div>
      </header>

      <main className="content">
        {activeTab === "clientes" && (
          <ClientesView baseUrl={baseUrl} token={token} />
        )}

        {activeTab === "envios" && (
          <EnviosView baseUrl={baseUrl} token={token} />
        )}

        {activeTab === "tarifa" && (
          <TarifaView
            baseUrl={baseUrl}
            token={token}
            onTarifaGenerada={(cotizacion) => {
              setCotizacionActual(cotizacion);
              setGuiaHabilitada(false);
              setActiveTab("boleta");
            }}
          />
        )}

        {activeTab === "boleta" && (
          cotizacionActual ? (
            <BoletaDoc
              cotizacion={cotizacionActual}
              onContinuarAGuia={() => {
                setGuiaHabilitada(true);
                setActiveTab("guia");
              }}
            />
          ) : (
            <section className="panel">
              <h2>Boleta</h2>
              <p className="helper">
                Primero calcula una tarifa en la pestaña <strong>Tarifa</strong> para generar la boleta.
              </p>
              <button
                type="button"
                className="primary-button"
                onClick={() => setActiveTab("tarifa")}
              >
                Ir a Tarifa
              </button>
            </section>
          )
        )}

          {activeTab === "guia" && (
          cotizacionActual && guiaHabilitada ? (
            <GuiaSeguimientoDoc
              cotizacion={cotizacionActual}
              baseUrl={baseUrl}
              token={token}
              onVolverABoleta={() => setActiveTab("boleta")}
            />
          ) : (
            <section className="panel">
              <h2>Guía de Seguimiento</h2>
              <p className="helper">
                {cotizacionActual
                  ? "Revisa primero la Boleta y presiona 'Continuar a Guía'."
                  : "Primero calcula una tarifa y revisa la boleta para emitir la guía."}
              </p>
              <button
                type="button"
                className="primary-button"
                onClick={() => setActiveTab(cotizacionActual ? "boleta" : "tarifa")}
              >
                {cotizacionActual ? "Ir a Boleta" : "Ir a Tarifa"}
              </button>
            </section>
          )
        )}

        {activeTab === "operaciones" && (
          <OperacionesView baseUrl={baseUrl} token={token} />
        )}

        {activeTab === "pruebas" && (
          <section>
            <div className="page-heading">
              <div>
                <p className="eyebrow">Pruebas de integracion HTTP</p>
                <h1>Pruebas del backend</h1>
              </div>
              <button
                className="primary-button"
                type="button"
                onClick={ejecutarPruebasBackend}
                disabled={testsRunning}
              >
                {testsRunning ? "Ejecutando..." : "Ejecutar todas las pruebas"}
              </button>
            </div>

            <div className="test-summary">
              <div>
                <span>URL del servicio</span>
                <strong>{baseUrl}</strong>
              </div>
              <div>
                <span>Estado</span>
                <strong>
                  {testResults.length === 0
                    ? "Sin ejecutar"
                    : `${passedCount}/${testResults.length} aprobadas`}
                </strong>
              </div>
            </div>

            {testResults.length === 0 ? (
              <div className="empty-tests">
                <strong>No hay resultados todavia</strong>
                <p>Ejecute las pruebas para mostrar los casos, estados HTTP y respuestas del backend.</p>
              </div>
            ) : (
              <div className="test-list">
                {testResults.map((item, idx) => (
                  <article
                    key={`${item.name}-${idx}`}
                    className={`test-item ${item.passed ? "passed" : "failed"}`}
                  >
                    <div className="test-item-header">
                      <div>
                        <span className="test-index">{idx + 1}</span>
                        <div>
                          <h2>{item.name}</h2>
                          <p>{item.description}</p>
                        </div>
                      </div>
                      <div className="test-badges">
                        <span>{item.status ?? "SIN RESP"}</span>
                        <span>{item.durationMs} ms</span>
                        <strong>{item.passed ? "APROBADA" : "FALLIDA"}</strong>
                      </div>
                    </div>
                    <div className="test-response">
                      <span>Esperado: HTTP {item.expected}</span>
                      <p className="helper">{resumenRespuesta(item.status, item.passed)}</p>
                      <pre>{item.response}</pre>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {settingsOpen && (
        <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="settings-title">Configuracion del servicio</h2>

            <div className="field">
              <label htmlFor="api-url">URL base del backend</label>
              <input
                id="api-url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://localhost:3001"
              />
            </div>

            <div className="field">
              <label htmlFor="api-token">Token Bearer</label>
              <input
                id="api-token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="JWT de acceso"
              />
            </div>

            <p className="helper">
              Se guarda automaticamente en localStorage para todas las vistas y pruebas.
            </p>

            <div className="form-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => setSettingsOpen(false)}
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}