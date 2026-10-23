/** Fallback for Android browsers which do not automatically open verified App Links. */
export function NativeVkReturn({intentUrl, ios = false}:{intentUrl:string;ios?:boolean}) {
  return <main className="min-h-screen bg-slate-950 px-6 py-20 text-center text-white">
    <div className="mx-auto max-w-sm rounded-3xl border border-lime-400/30 bg-slate-900 p-7">
      <p className="text-sm font-bold text-lime-300">SportBuddy78</p>
      <h1 className="mt-4 text-2xl font-black">Вернитесь в приложение</h1>
      <p className="mt-4 text-sm leading-relaxed text-slate-300">Чтобы завершить вход через VK ID, откройте установленное приложение кнопкой ниже.</p>
      <a href={intentUrl} className="mt-6 block rounded-2xl bg-lime-300 px-4 py-4 font-bold text-slate-950">Открыть SportBuddy78</a>
      <p className="mt-4 text-xs leading-relaxed text-slate-400">{ios ? 'Если приложение не открылось, убедитесь, что SportBuddy78 установлен на iPhone, и начните вход заново.' : 'Если приложение не открылось, разрешите ему открывать поддерживаемые ссылки в настройках Android и начните вход заново.'}</p>
    </div>
  </main>;
}
