import { menuOptions } from "@/utils/menuOptions";
import { faGithub, faFacebookF, faInstagram, faXTwitter } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="w-full bg-zinc-950 py-8 px-10">
      <div className="w-full flex flex-col items-center gap-6">
        <nav>
          <ul className="flex justify-center items-center gap-8">
            {menuOptions.map((option, index) => (
              <li key={index} className="text-xs lg:text-base font-inconsolata text-zinc-400 hover:text-zinc-100 text-center hover:scale-105 transition-all duration-100 cursor-pointer">
                <Link href={option.url}>{option.text}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex justify-center items-center gap-6">
          <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-pink-500 transition-colors">
            <FontAwesomeIcon icon={faInstagram} className="text-xl" />
          </a>
          <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-blue-500 transition-colors">
            <FontAwesomeIcon icon={faFacebookF} className="text-xl" />
          </a>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white transition-colors">
            <FontAwesomeIcon icon={faGithub} className="text-xl" />
          </a>
          <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white transition-colors">
            <FontAwesomeIcon icon={faXTwitter} className="text-xl" />
          </a>
        </div>

        <p className="font-inconsolata text-zinc-500 text-sm text-center">© 2026 GameBank. Todos os direitos reservados - v1.3.0</p>
      </div>
    </footer>
  )
}