(function () {
  "use strict";

  const STORAGE_KEY = "ff-outfit-reservations-v1";

  class StorageError extends Error {
    constructor(code, message) {
      super(message);
      this.name = "StorageError";
      this.code = code;
    }
  }

  function randomCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = new Uint8Array(10);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, value => alphabet[value % alphabet.length]).join("");
  }

  class LocalStorageAdapter {
    constructor(storage = window.localStorage) {
      this.storage = storage;
      this.listeners = new Set();
      this._onStorage = event => {
        if (event.key === STORAGE_KEY) this._emit();
      };
      window.addEventListener?.("storage", this._onStorage);
    }

    _readObject() {
      try {
        const raw = this.storage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch (error) {
        throw new StorageError("INVALID_LOCAL_DATA", "Los datos locales están dañados.");
      }
    }

    _writeObject(data) {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(data));
      this._emit();
    }

    _emit() {
      this.list().then(rows => this.listeners.forEach(listener => listener(rows))).catch(() => {});
    }

    async list() {
      return Object.values(this._readObject());
    }

    async reserve(outfitId, alias) {
      const data = this._readObject();
      if (data[outfitId]) throw new StorageError("OCCUPIED", "Este atuendo ya está ocupado.");
      const reservation = {
        outfit_id: outfitId,
        alias: alias.trim(),
        release_code: randomCode(),
        reserved_at: new Date().toISOString()
      };
      data[outfitId] = reservation;
      this._writeObject(data);
      return reservation;
    }

    async release(outfitId, code) {
      const data = this._readObject();
      const reservation = data[outfitId];
      if (!reservation) throw new StorageError("NOT_FOUND", "La reserva ya no existe.");
      if (reservation.release_code.toUpperCase() !== code.trim().toUpperCase()) {
        throw new StorageError("INVALID_CODE", "El código de liberación no es correcto.");
      }
      delete data[outfitId];
      this._writeObject(data);
      return true;
    }

    subscribe(listener) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    destroy() {
      window.removeEventListener?.("storage", this._onStorage);
      this.listeners.clear();
    }
  }

  class SupabaseStorageAdapter {
    constructor(config) {
      if (!config?.url || !config?.anonKey || config.url.includes("TU_PROYECTO")) {
        throw new StorageError("CONFIG", "Falta configurar Supabase en config.js.");
      }
      this.url = config.url.replace(/\/$/, "");
      this.anonKey = config.anonKey;
      this.table = config.table || "outfit_reservations";
      this.pollIntervalMs = Math.max(2000, Number(config.pollIntervalMs) || 5000);
      this.listeners = new Set();
      this.timer = null;
    }

    get headers() {
      return {
        apikey: this.anonKey,
        Authorization: `Bearer ${this.anonKey}`,
        "Content-Type": "application/json"
      };
    }

    async _request(path, options = {}) {
      const response = await fetch(`${this.url}/rest/v1/${path}`, {
        ...options,
        headers: { ...this.headers, ...(options.headers || {}) }
      });
      if (!response.ok) {
        const text = await response.text();
        if (response.status === 409) throw new StorageError("OCCUPIED", "Este atuendo ya está ocupado.");
        throw new StorageError("REMOTE", `Supabase devolvió ${response.status}: ${text || response.statusText}`);
      }
      if (response.status === 204) return null;
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    }

    async list() {
      return await this._request("rpc/list_outfit_reservations", {
        method: "POST",
        body: "{}"
      });
    }

    async reserve(outfitId, alias) {
      const releaseCode = randomCode();
      try {
        const rows = await this._request("rpc/reserve_outfit", {
          method: "POST",
          body: JSON.stringify({
            p_outfit_id: outfitId,
            p_alias: alias.trim(),
            p_release_code: releaseCode
          })
        });
        this._emit();
        return {
          outfit_id: outfitId,
          alias: alias.trim(),
          release_code: rows?.[0]?.release_code || releaseCode,
          reserved_at: rows?.[0]?.reserved_at || new Date().toISOString()
        };
      } catch (error) {
        if (error.code === "REMOTE" && /duplicate key|23505/i.test(error.message)) {
          throw new StorageError("OCCUPIED", "Este atuendo ya está ocupado.");
        }
        throw error;
      }
    }

    async release(outfitId, code) {
      const result = await this._request("rpc/release_outfit", {
        method: "POST",
        body: JSON.stringify({
          p_outfit_id: outfitId,
          p_release_code: code.trim().toUpperCase()
        })
      });
      if (result !== true) throw new StorageError("INVALID_CODE", "El código de liberación no es correcto.");
      this._emit();
      return true;
    }

    async _emit() {
      try {
        const rows = await this.list();
        this.listeners.forEach(listener => listener(rows));
      } catch (_) {}
    }

    subscribe(listener) {
      this.listeners.add(listener);
      if (!this.timer) this.timer = setInterval(() => this._emit(), this.pollIntervalMs);
      return () => {
        this.listeners.delete(listener);
        if (!this.listeners.size && this.timer) {
          clearInterval(this.timer);
          this.timer = null;
        }
      };
    }

    destroy() {
      if (this.timer) clearInterval(this.timer);
      this.listeners.clear();
    }
  }

  function createAdapter(config = {}) {
    if (config.mode === "supabase") return new SupabaseStorageAdapter(config.supabase);
    return new LocalStorageAdapter();
  }

  window.OutfitStorage = {
    createAdapter,
    LocalStorageAdapter,
    SupabaseStorageAdapter,
    StorageError,
    STORAGE_KEY
  };
})();
