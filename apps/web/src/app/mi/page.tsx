import { redirect } from "next/navigation";

/** El portal del propietario abre en "Mis mascotas". */
export default function PaginaMiPortal() {
  redirect("/mi/mascotas");
}
