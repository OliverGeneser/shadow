export function deriveSecretKey(privateKey: CryptoKey, publicKey: CryptoKey) {
  return window.crypto.subtle.deriveKey(
    {
      name: "ECDH",
      public: publicKey,
    },
    privateKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptMessage(
  key: CryptoKey,
  initializationVector: Uint8Array,
  message: ArrayBuffer,
) {
  try {
    return await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: initializationVector },
      key,
      message,
    );
  } catch (e) {
    console.log(e);
  }
}

export async function decryptMessage(
  key: CryptoKey,
  initializationVector: Uint8Array,
  ciphertext: Uint8Array,
) {
  try {
    return await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: initializationVector },
      key,
      ciphertext,
    );
  } catch (e) {
    console.log(e);
  }
}
