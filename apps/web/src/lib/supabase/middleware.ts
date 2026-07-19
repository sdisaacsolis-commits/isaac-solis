import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const PREFIJO_PRIVADO = "/app";
// El usuario autenticado no debe regresar a estas rutas.
// /actualizar-contrasena NO está aquí: el enlace de recuperación crea sesión
// y la persona debe poder llegar a esa página ya autenticada.
const RUTAS_SOLO_ANONIMAS = ["/iniciar-sesion", "/registro", "/recuperar-contrasena"];

/**
 * Refresca la sesión de Supabase en cada petición (patrón oficial de
 * @supabase/ssr) y aplica la protección de rutas privadas en el borde.
 * La autorización real de datos sigue siendo RLS: esto solo es UX.
 */
export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const path = request.nextUrl.pathname;

  // Sin Supabase configurado no puede existir sesión: las rutas privadas
  // redirigen a iniciar sesión (que muestra el aviso de configuración).
  if (!url || !anonKey) {
    if (path.startsWith(PREFIJO_PRIVADO)) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/iniciar-sesion";
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANTE: no ejecutar lógica entre createServerClient y getUser.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && path.startsWith(PREFIJO_PRIVADO)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/iniciar-sesion";
    redirectUrl.search = "";
    redirectUrl.searchParams.set("next", `${path}${request.nextUrl.search}`);
    const redirect = NextResponse.redirect(redirectUrl);
    supabaseResponse.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  if (user && RUTAS_SOLO_ANONIMAS.includes(path)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/app/inicio";
    redirectUrl.search = "";
    const redirect = NextResponse.redirect(redirectUrl);
    supabaseResponse.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return supabaseResponse;
}
