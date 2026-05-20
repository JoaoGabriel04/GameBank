import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

type Colors = 
  | 'purple' 
  | 'green' 
  | 'amber'

type ColorConfig = {
  value: Colors;
  iconColor: string;
  circleBg: string;
  title: string;
}

const COLORS_LIST: ColorConfig[] = [
  { value: 'purple', iconColor: '#F8DBFF', circleBg: '#7B00FF', title: 'text-purple-600' },
  { value: 'green', iconColor: '#E6FFE2', circleBg: '#00BE39', title: 'text-green-600' },
  { value: 'amber', iconColor: '#FFF3D3', circleBg: '#FFA600', title: 'text-amber-600' }
]

type Props = {
  color: Colors;
  icon: IconDefinition;
  title: string;
  description: string;
}

export default function CardFeatures({ color, icon, title, description }: Props) {
  const colorConfig = COLORS_LIST.find(c => c.value === color) || COLORS_LIST[0];

  return (
    <div className="w-full h-full flex flex-col items-center space-y-4">
      <div 
        className="w-50 h-50 border-3 border-zinc-50 flex justify-center items-center rounded-full"
        style={{ backgroundColor: colorConfig.circleBg }}
      >
        <FontAwesomeIcon 
          icon={icon} 
          className="text-8xl"
          style={{ color: colorConfig.iconColor, filter: `drop-shadow(0px 0px 20px ${colorConfig.iconColor})` }}
        />
      </div>
      <h1 className={`text-2xl font-bold font-jaro ${colorConfig.title}`}>{title}</h1>
      <p className="w-2/4 text-lg font-inconsolata text-zinc-500 text-center">{description}</p>
    </div>
  )
}