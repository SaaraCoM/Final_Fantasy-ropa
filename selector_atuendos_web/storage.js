(function () {
  "use strict";

  const STORAGE_KEY = "ff-outfit-reservations-v1";
  const OWNER_KEY = "ff-outfit-owner-tokens-v1";

  class StorageError extends Error {
    constructor(code, message) {
      super(message);
      this.name = "StorageError";
      this.code = code;
    }
  }

  function randomToken() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
  }

  async function sha256Hex(value) {
    const encoded = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
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

    _readOwners() {
      try {
        const raw = this.storage.getItem(OWNER_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch (error) {
        throw new StorageError("INVALID_LOCAL_DATA", "Los datos locales están dañados.");
      }
    }

    _writeOwners(data) {
      this.storage.setItem(OWNER_KEY, JSON.stringify(data));
    }

    _rememberOwner(outfitId, ownerTokenHash) {
      const owners = this._readOwners();
      owners[outfitId] = ownerTokenHash;
      this._writeOwners(owners);
    }

    _forgetOwner(outfitId) {
      const owners = this._readOwners();
      delete owners[outfitId];
      this._writeOwners(owners);
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
      const ownerTokenHash = await sha256Hex(randomToken());
      const reservation = {
        outfit_id: outfitId,
        alias: alias.trim(),
        owner_token_hash: ownerTokenHash,
        reserved_at: new Date().toISOString()
      };
      data[outfitId] = reservation;
      this._rememberOwner(outfitId, ownerTokenHash);
      this._writeObject(data);
      return reservation;
    }

    async release(outfitId) {
      const data = this._readObject();
      const reservation = data[outfitId];
      if (!reservation) throw new StorageError("NOT_FOUND", "La reserva ya no existe.");
      if (reservation.owner_token_hash && this._readOwners()[outfitId] !== reservation.owner_token_hash) {
        throw new StorageError("FORBIDDEN", "Solo el dispositivo que reservó este atuendo puede desocuparlo.");
      }
      delete data[outfitId];
      this._forgetOwner(outfitId);
      this._writeObject(data);
      return true;
    }

    owns(outfitId) {
      const reservation = this._readObject()[outfitId];
      if (!reservation) return false;
      if (!reservation.owner_token_hash) return true;
      return this._readOwners()[outfitId] === reservation.owner_token_hash;
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
      this.storage = window.localStorage;
    }

    _readOwners() {
      try {
        const raw = this.storage.getItem(OWNER_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch (error) {
        throw new StorageError("INVALID_LOCAL_DATA", "Los datos locales están dañados.");
      }
    }

    _writeOwners(data) {
      this.storage.setItem(OWNER_KEY, JSON.stringify(data));
    }

    _rememberOwner(outfitId, ownerTokenHash) {
      const owners = this._readOwners();
      owners[outfitId] = ownerTokenHash;
      this._writeOwners(owners);
    }

    _forgetOwner(outfitId) {
      const owners = this._readOwners();
      delete owners[outfitId];
      this._writeOwners(owners);
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
      const ownerTokenHash = await sha256Hex(randomToken());
      try {
        const rows = await this._request("rpc/reserve_outfit", {
          method: "POST",
          body: JSON.stringify({
            p_outfit_id: outfitId,
            p_alias: alias.trim(),
            p_owner_token_hash: ownerTokenHash
          })
        });
        this._rememberOwner(outfitId, ownerTokenHash);
        this._emit();
        return {
          outfit_id: outfitId,
          alias: alias.trim(),
          reserved_at: rows?.[0]?.reserved_at || new Date().toISOString()
        };
      } catch (error) {
        if (error.code === "REMOTE" && /duplicate key|23505/i.test(error.message)) {
          throw new StorageError("OCCUPIED", "Este atuendo ya está ocupado.");
        }
        throw error;
      }
    }

    async release(outfitId) {
      const ownerTokenHash = this._readOwners()[outfitId];
      if (!ownerTokenHash) throw new StorageError("FORBIDDEN", "Solo el dispositivo que reservó este atuendo puede desocuparlo.");
      const result = await this._request("rpc/release_outfit", {
        method: "POST",
        body: JSON.stringify({
          p_outfit_id: outfitId,
          p_owner_token_hash: ownerTokenHash
        })
      });
      if (result !== true) throw new StorageError("FORBIDDEN", "Solo el dispositivo que reservó este atuendo puede desocuparlo.");
      this._forgetOwner(outfitId);
      this._emit();
      return true;
    }

    owns(outfitId) {
      return Boolean(this._readOwners()[outfitId]);
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
    STORAGE_KEY,
    OWNER_KEY
  };
})();
